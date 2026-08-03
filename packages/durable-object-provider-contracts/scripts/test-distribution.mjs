import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  cp,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { createGunzip, gzipSync } from "node:zlib";

import {
  FIXED_PROVIDER_RESOURCES,
  assertExactProviderResourceEntries,
} from "./lib/provider-resource-inventory.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const viteCommand = join(
  packageRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vite.CMD" : "vite",
);
const typescriptCli = join(
  packageRoot,
  "node_modules",
  "typescript",
  "bin",
  "tsc",
);
const MAX_UNCOMPRESSED_PACK_BYTES = 64 * 1024 * 1024;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      [
        `Distribution command failed (${result.status ?? "spawn error"})`,
        [command, ...args].join(" "),
        result.stdout?.trim(),
        result.stderr?.trim(),
        result.error?.stack,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result;
}

const bareNodeBuiltinSpecifiers = new Set(
  builtinModules.map((specifier) => specifier.replace(/^node:/u, "")),
);

function findBrowserNodeRuntimeDependency(source) {
  if (source.includes("__vite-browser-external")) {
    return "Vite browser-external shim";
  }
  if (
    /(?:\brequire\s*\(|\bprocess\s*(?:\.|\[)|\bBuffer\b|\b__dirname\b|\b__filename\b)/u.test(
      source,
    )
  ) {
    return "Node runtime global";
  }

  const importSpecifierPattern =
    /\b(?:from|import)\s*(?:\(\s*)?["']([^"']+)["']/gu;
  for (const match of source.matchAll(importSpecifierPattern)) {
    const specifier = match[1];
    if (specifier === undefined) continue;
    if (specifier.startsWith("node:")) {
      return `Node builtin import ${specifier}`;
    }
    if (bareNodeBuiltinSpecifiers.has(specifier)) {
      return `bare Node builtin import ${specifier}`;
    }
  }
  return undefined;
}

for (const regressionSource of [
  'export const latentCrypto = () => import("crypto");',
  'import shim from "./__vite-browser-external-latent.js";',
  'export { readFile } from "node:fs";',
]) {
  if (findBrowserNodeRuntimeDependency(regressionSource) === undefined) {
    throw new Error("Browser Node-runtime detector regression");
  }
}
if (
  findBrowserNodeRuntimeDependency(
    'export const loadHelper = () => import("./crypto-helper.js");',
  ) !== undefined
) {
  throw new Error("Browser Node-runtime detector rejected a relative module");
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function listFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolutePath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

async function listRelativeSchemaPaths(schemaRoot) {
  return (await listFiles(schemaRoot))
    .filter((filePath) => filePath.endsWith(".schema.json"))
    .map((filePath) => relative(schemaRoot, filePath).split(sep).join("/"))
    .sort();
}

function assertExactSortedPathSet(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((filePath) => !actualSet.has(filePath));
  const extra = actual.filter((filePath) => !expectedSet.has(filePath));
  if (
    actual.length !== actualSet.size ||
    expected.length !== expectedSet.size ||
    actual.length !== expected.length ||
    actual.some((filePath, index) => filePath !== expected[index]) ||
    missing.length !== 0 ||
    extra.length !== 0
  ) {
    throw new Error(
      `${label} differs: missing=[${missing.join(", ")}], extra=[${extra.join(", ")}]`,
    );
  }
}

async function assertExactProviderDirectory(providerRoot, label) {
  const directoryEntries = await readdir(providerRoot);
  const entries = await Promise.all(
    directoryEntries.map(async (name) => {
      const resourcePath = join(providerRoot, name);
      const metadata = await lstat(resourcePath);
      const regular = metadata.isFile();
      return {
        path: name,
        type: regular ? "regular" : "other",
        nlink: metadata.nlink,
        bytes: regular
          ? new Uint8Array(await readFile(resourcePath))
          : new Uint8Array(),
      };
    }),
  );
  assertExactProviderResourceEntries(
    entries,
    FIXED_PROVIDER_RESOURCES,
    `${label} provider inventory`,
  );
}

async function expectAsyncRejection(operation, label) {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(`${label} regression was not rejected`);
}

function readTarString(header, offset, length) {
  const field = header.subarray(offset, offset + length);
  const terminator = field.indexOf(0);
  return field
    .subarray(0, terminator === -1 ? field.length : terminator)
    .toString("utf8");
}

function readTarOctal(header, offset, length, label) {
  const field = header.subarray(offset, offset + length);
  if ((field[0] ?? 0) >= 0x80) {
    throw new Error(`${label} uses unsupported base-256 encoding`);
  }
  const text = field
    .toString("ascii")
    .replace(/\0.*$/u, "")
    .trim();
  if (!/^[0-7]+$/u.test(text)) {
    throw new Error(`${label} is not canonical octal`);
  }
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} is outside the safe range`);
  }
  return value;
}

function assertTarHeaderChecksum(header, entryOffset) {
  const expected = readTarOctal(
    header,
    148,
    8,
    `tar checksum at ${entryOffset}`,
  );
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual +=
      index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (actual !== expected) {
    throw new Error(`tar checksum mismatch at ${entryOffset}`);
  }
}

function parsePaxAttributes(payload) {
  const attributes = new Map();
  let offset = 0;
  while (offset < payload.byteLength) {
    const separator = payload.indexOf(0x20, offset);
    if (separator === -1) {
      throw new Error("invalid PAX record length");
    }
    const lengthText = payload
      .subarray(offset, separator)
      .toString("ascii");
    if (!/^[1-9][0-9]*$/u.test(lengthText)) {
      throw new Error("invalid PAX record length");
    }
    const recordLength = Number.parseInt(lengthText, 10);
    const recordEnd = offset + recordLength;
    if (
      !Number.isSafeInteger(recordLength) ||
      recordEnd > payload.byteLength ||
      payload[recordEnd - 1] !== 0x0a
    ) {
      throw new Error("invalid PAX record boundary");
    }
    const record = new TextDecoder("utf-8", { fatal: true }).decode(
      payload.subarray(separator + 1, recordEnd - 1),
    );
    const equals = record.indexOf("=");
    if (equals <= 0) throw new Error("invalid PAX attribute");
    const key = record.slice(0, equals);
    if (attributes.has(key)) {
      throw new Error(`duplicate PAX attribute ${key}`);
    }
    attributes.set(key, record.slice(equals + 1));
    offset = recordEnd;
  }
  return attributes;
}

function assertSupportedPaxAttributes(attributes, scope) {
  const allowedKeys =
    scope === "local" ? new Set(["path"]) : new Set();
  for (const key of attributes.keys()) {
    if (!allowedKeys.has(key)) {
      throw new Error(
        `${scope} PAX attribute ${key} is not supported`,
      );
    }
  }
  if (
    scope === "local" &&
    (attributes.size !== 1 ||
      (attributes.get("path")?.length ?? 0) === 0)
  ) {
    throw new Error(
      "local PAX header must contain exactly one non-empty path",
    );
  }
  if (scope === "global" && attributes.size !== 0) {
    throw new Error("global PAX attributes are not supported");
  }
}

function expectSynchronousRejection(operation, label) {
  try {
    operation();
  } catch {
    return;
  }
  throw new Error(`${label} regression was not rejected`);
}

expectSynchronousRejection(
  () =>
    assertSupportedPaxAttributes(
      parsePaxAttributes(Buffer.from("10 size=1\n", "ascii")),
      "local",
    ),
  "PAX size override",
);
expectSynchronousRejection(
  () =>
    assertSupportedPaxAttributes(
      parsePaxAttributes(Buffer.from("11 mtime=0\n", "ascii")),
      "global",
    ),
  "global PAX metadata",
);

function collidesWithProviderArchivePath(path) {
  const normalizedSegments = [];
  for (const segment of path.replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      normalizedSegments.pop();
    } else {
      normalizedSegments.push(segment);
    }
  }
  const collisionKey = normalizedSegments
    .join("/")
    .normalize("NFC")
    .toLowerCase();
  return (
    collisionKey === "package/provider" ||
    collisionKey.startsWith("package/provider/")
  );
}

async function readGunzipBounded(tarballPath) {
  const chunks = [];
  let total = 0;
  const gunzip = createReadStream(tarballPath).pipe(createGunzip());
  for await (const chunk of gunzip) {
    total += chunk.byteLength;
    if (total > MAX_UNCOMPRESSED_PACK_BYTES) {
      gunzip.destroy();
      throw new Error("packed archive exceeds the verification byte cap");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function assertExactProviderTarInventory(
  tarballPath,
  label,
) {
  const archive = await readGunzipBounded(tarballPath);
  const providerEntries = [];
  let offset = 0;
  let pendingPaxPath;
  let pendingLongPath;
  let zeroBlockCount = 0;

  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      zeroBlockCount += 1;
      offset += 512;
      if (zeroBlockCount === 2) break;
      continue;
    }
    if (zeroBlockCount !== 0) {
      throw new Error("non-zero tar header follows an end marker");
    }

    assertTarHeaderChecksum(header, offset);
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const headerPath = prefix.length === 0 ? name : `${prefix}/${name}`;
    const size = readTarOctal(header, 124, 12, `tar size for ${headerPath}`);
    const typeFlag = String.fromCharCode(header[156] ?? 0);
    const linkPath = readTarString(header, 157, 100);
    const payloadStart = offset + 512;
    const payloadEnd = payloadStart + size;
    if (payloadEnd > archive.byteLength) {
      throw new Error(`truncated tar payload for ${headerPath}`);
    }
    const payload = archive.subarray(payloadStart, payloadEnd);
    offset =
      payloadStart + Math.ceil(size / 512) * 512;

    if (typeFlag === "x") {
      if (pendingPaxPath !== undefined || pendingLongPath !== undefined) {
        throw new Error("stacked tar path extension");
      }
      const attributes = parsePaxAttributes(payload);
      assertSupportedPaxAttributes(attributes, "local");
      pendingPaxPath = attributes.get("path");
      continue;
    }
    if (typeFlag === "g") {
      const attributes = parsePaxAttributes(payload);
      assertSupportedPaxAttributes(attributes, "global");
      continue;
    }
    if (typeFlag === "L") {
      if (pendingPaxPath !== undefined || pendingLongPath !== undefined) {
        throw new Error("stacked tar path extension");
      }
      const terminator = payload.indexOf(0);
      pendingLongPath = payload
        .subarray(
          0,
          terminator === -1 ? payload.byteLength : terminator,
        )
        .toString("utf8");
      continue;
    }

    const effectivePath =
      pendingPaxPath ?? pendingLongPath ?? headerPath;
    pendingPaxPath = undefined;
    pendingLongPath = undefined;
    if (collidesWithProviderArchivePath(effectivePath)) {
      providerEntries.push({
        path: effectivePath,
        typeFlag,
        linkPath,
        size,
        payload,
      });
    }
  }

  if (
    pendingPaxPath !== undefined ||
    pendingLongPath !== undefined ||
    zeroBlockCount < 2
  ) {
    throw new Error("packed tar has an incomplete terminal structure");
  }
  if (archive.subarray(offset).some((byte) => byte !== 0)) {
    throw new Error(
      "packed tar contains non-zero data after its terminal marker",
    );
  }

  assertExactProviderResourceEntries(
    providerEntries.map((entry) => ({
      path: entry.path,
      type:
        (entry.typeFlag === "0" || entry.typeFlag === "\0") &&
        entry.linkPath === "" &&
        !entry.path.includes("\\") &&
        !entry.path
          .split("/")
          .some((segment) => segment === "." || segment === "..")
          ? "regular"
          : "other",
      nlink: entry.typeFlag === "1" ? 2 : 1,
      bytes: new Uint8Array(entry.payload),
    })),
    FIXED_PROVIDER_RESOURCES.map((resource) => ({
      ...resource,
      path: resource.archivePath,
    })),
    `${label} tar provider inventory`,
  );
}

function duplicateTarMemberForRegression(
  archive,
  targetPath,
) {
  let offset = 0;
  let member;
  let endMarkerOffset;
  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      endMarkerOffset = offset;
      break;
    }
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const path = prefix.length === 0 ? name : `${prefix}/${name}`;
    const size = readTarOctal(
      header,
      124,
      12,
      `regression tar size for ${path}`,
    );
    const memberEnd =
      offset + 512 + Math.ceil(size / 512) * 512;
    if (path === targetPath) {
      member = archive.subarray(offset, memberEnd);
    }
    offset = memberEnd;
  }
  if (member === undefined || endMarkerOffset === undefined) {
    throw new Error("could not construct duplicate tar regression");
  }
  return Buffer.concat([
    archive.subarray(0, endMarkerOffset),
    member,
    archive.subarray(endMarkerOffset),
  ]);
}

function appendTarMemberAfterEndForRegression(
  archive,
  targetPath,
) {
  let offset = 0;
  let member;
  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const path = prefix.length === 0 ? name : `${prefix}/${name}`;
    const size = readTarOctal(
      header,
      124,
      12,
      `trailing regression tar size for ${path}`,
    );
    const memberEnd =
      offset + 512 + Math.ceil(size / 512) * 512;
    if (path === targetPath) {
      member = archive.subarray(offset, memberEnd);
    }
    offset = memberEnd;
  }
  if (member === undefined) {
    throw new Error(
      "could not construct trailing tar member regression",
    );
  }
  return Buffer.concat([archive, member, Buffer.alloc(1_024)]);
}

function mutateTarMemberTypeForRegression(
  archive,
  targetPath,
  typeFlag,
  linkPath,
) {
  const mutated = Buffer.from(archive);
  let offset = 0;
  while (offset + 512 <= mutated.byteLength) {
    const header = mutated.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const path = prefix.length === 0 ? name : `${prefix}/${name}`;
    const size = readTarOctal(
      header,
      124,
      12,
      `regression tar size for ${path}`,
    );
    if (path === targetPath) {
      header[156] = typeFlag.charCodeAt(0);
      header.fill(0, 157, 257);
      const encodedLinkPath = Buffer.from(linkPath, "utf8");
      if (encodedLinkPath.byteLength > 100) {
        throw new Error("regression tar link path is too long");
      }
      encodedLinkPath.copy(header, 157);
      header.fill(0x20, 148, 156);
      let checksum = 0;
      for (const byte of header) checksum += byte;
      const checksumField = `${checksum.toString(8).padStart(6, "0")}\0 `;
      Buffer.from(checksumField, "ascii").copy(header, 148);
      return mutated;
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`could not mutate tar member ${targetPath}`);
}

function packageSpecifier(exportKey) {
  return exportKey === "."
    ? "@understand-code/durable-object-provider-contracts"
    : `@understand-code/durable-object-provider-contracts${exportKey.slice(1)}`;
}

const temporaryRoot = await mkdtemp(
  join(tmpdir(), "understand-code-provider-contracts-distribution-"),
);

try {
  const sourceSchemaRelativePaths = await listRelativeSchemaPaths(
    join(packageRoot, "schemas", "v1"),
  );
  if (sourceSchemaRelativePaths.length === 0) {
    throw new Error("Source provider contracts contain no JSON Schemas");
  }
  await assertExactProviderDirectory(
    join(packageRoot, "provider"),
    "source",
  );
  const inventoryRegressionRoot = join(
    temporaryRoot,
    "provider-inventory-regression",
  );
  await cp(
    join(packageRoot, "provider"),
    inventoryRegressionRoot,
    { recursive: true },
  );
  await writeFile(
    join(inventoryRegressionRoot, "alternate-bundle.json"),
    "{}",
    "utf8",
  );
  await expectAsyncRejection(
    () =>
      assertExactProviderDirectory(
        inventoryRegressionRoot,
        "extra-file regression",
      ),
    "extra provider file",
  );
  await rm(join(inventoryRegressionRoot, "alternate-bundle.json"));
  await rm(
    join(
      inventoryRegressionRoot,
      "bootstrap-trust-bundle-v1.json",
    ),
  );
  await symlink(
    "ed25519-strict-host-conformance-v1.json",
    join(
      inventoryRegressionRoot,
      "bootstrap-trust-bundle-v1.json",
    ),
  );
  await expectAsyncRejection(
    () =>
      assertExactProviderDirectory(
        inventoryRegressionRoot,
        "symlink regression",
      ),
    "provider symlink",
  );
  await rm(
    join(
      inventoryRegressionRoot,
      "bootstrap-trust-bundle-v1.json",
    ),
  );
  await cp(
    join(
      packageRoot,
      "provider",
      "bootstrap-trust-bundle-v1.json",
    ),
    join(
      inventoryRegressionRoot,
      "bootstrap-trust-bundle-v1.json",
    ),
  );
  const hardlinkWitnessPath = join(
    temporaryRoot,
    "provider-hardlink-witness.json",
  );
  await link(
    join(
      inventoryRegressionRoot,
      "bootstrap-trust-bundle-v1.json",
    ),
    hardlinkWitnessPath,
  );
  await expectAsyncRejection(
    () =>
      assertExactProviderDirectory(
        inventoryRegressionRoot,
        "hardlink regression",
      ),
    "provider hardlink",
  );
  await rm(hardlinkWitnessPath);

  const cleanPackageRoot = join(temporaryRoot, "package");
  const packRoot = join(temporaryRoot, "pack");
  const consumerRoot = join(temporaryRoot, "consumer");
  await mkdir(packRoot, { recursive: true });
  await mkdir(consumerRoot, { recursive: true });
  await cp(packageRoot, cleanPackageRoot, {
    recursive: true,
    filter(sourcePath) {
      const sourceRelativePath = relative(packageRoot, sourcePath);
      if (sourceRelativePath === "") return true;
      const topLevelSegment = sourceRelativePath.split(sep)[0];
      return topLevelSegment !== "dist" && topLevelSegment !== "node_modules";
    },
  });
  await symlink(
    join(packageRoot, "node_modules"),
    join(cleanPackageRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assertExactProviderDirectory(
    join(cleanPackageRoot, "provider"),
    "clean pack source",
  );

  run(npmCommand, ["pack", ".", "--pack-destination", packRoot, "--silent"], {
    cwd: cleanPackageRoot,
  });
  const tarballs = (await readdir(packRoot))
    .filter((name) => name.endsWith(".tgz"))
    .sort();
  if (tarballs.length !== 1) {
    throw new Error(`Expected one package tarball, found ${tarballs.join(", ")}`);
  }
  await assertExactProviderTarInventory(
    join(packRoot, tarballs[0]),
    "npm pack",
  );
  const duplicateTarRegressionPath = join(
    temporaryRoot,
    "duplicate-provider-member.tgz",
  );
  await writeFile(
    duplicateTarRegressionPath,
    gzipSync(
      duplicateTarMemberForRegression(
        await readGunzipBounded(join(packRoot, tarballs[0])),
        FIXED_PROVIDER_RESOURCES[0].archivePath,
      ),
    ),
  );
  await expectAsyncRejection(
    () =>
      assertExactProviderTarInventory(
        duplicateTarRegressionPath,
        "duplicate-member regression",
      ),
    "duplicate provider tar member",
  );
  const trailingTarRegressionPath = join(
    temporaryRoot,
    "trailing-provider-member.tgz",
  );
  await writeFile(
    trailingTarRegressionPath,
    gzipSync(
      appendTarMemberAfterEndForRegression(
        await readGunzipBounded(join(packRoot, tarballs[0])),
        FIXED_PROVIDER_RESOURCES[0].archivePath,
      ),
    ),
  );
  await expectAsyncRejection(
    () =>
      assertExactProviderTarInventory(
        trailingTarRegressionPath,
        "trailing-member regression",
      ),
    "provider tar member after terminal marker",
  );
  for (const [typeFlag, label] of [
    ["1", "hardlink"],
    ["2", "symlink"],
  ]) {
    const linkedTarRegressionPath = join(
      temporaryRoot,
      `${label}-provider-member.tgz`,
    );
    await writeFile(
      linkedTarRegressionPath,
      gzipSync(
        mutateTarMemberTypeForRegression(
          await readGunzipBounded(join(packRoot, tarballs[0])),
          FIXED_PROVIDER_RESOURCES[0].archivePath,
          typeFlag,
          FIXED_PROVIDER_RESOURCES[1].archivePath,
        ),
      ),
    );
    await expectAsyncRejection(
      () =>
        assertExactProviderTarInventory(
          linkedTarRegressionPath,
          `${label}-member regression`,
        ),
      `provider tar ${label}`,
    );
  }

  run(
    npmCommand,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      join(packRoot, tarballs[0]),
    ],
    { cwd: consumerRoot },
  );

  const installedRoot = join(
    consumerRoot,
    "node_modules",
    "@understand-code",
    "durable-object-provider-contracts",
  );
  await assertExactProviderDirectory(
    join(installedRoot, "provider"),
    "installed package",
  );
  const manifest = JSON.parse(
    await readFile(join(installedRoot, "package.json"), "utf8"),
  );
  const explicitSpecifiers = Object.keys(manifest.exports)
    .filter((key) => !key.includes("*"))
    .map(packageSpecifier);
  const installedStrictManifestPath = await realpath(
    join(
      installedRoot,
      "provider",
      "ed25519-strict-host-conformance-v1.json",
    ),
  );
  const installedBootstrapBundlePath = await realpath(
    join(
      installedRoot,
      "provider",
      "bootstrap-trust-bundle-v1.json",
    ),
  );
  const installedBootstrapGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-bootstrap-structure-crypto-v1.json",
    ),
  );
  const installedBootstrapInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-bootstrap-structure-crypto-v1.json",
    ),
  );
  const installedRootHistoryGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-registry-root-history-v1.json",
    ),
  );
  const installedRootHistoryInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-root-history-v1.json",
    ),
  );
  const installedRegistryManifestGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-registry-entry-manifest-history-v1.json",
    ),
  );
  const installedRegistryManifestInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-entry-manifest-history-v1.json",
    ),
  );
  const installedRegistryManifestInvalidRecipePath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-entry-manifest-history-v1.recipe-dialect.md",
    ),
  );

  const runtimeProbe = join(consumerRoot, "runtime-probe.mjs");
  await writeFile(
    runtimeProbe,
    [
      'import { readFile, realpath } from "node:fs/promises";',
      'import { createHash, createHmac, createPrivateKey, createPublicKey, sign } from "node:crypto";',
      'import { fileURLToPath } from "node:url";',
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as providerContractModule${index} from ${JSON.stringify(specifier)};`,
      ),
      `const modules = [${explicitSpecifiers.map((_, index) => `providerContractModule${index}`).join(", ")}];`,
      'if (modules.some((module) => Object.keys(module).length === 0)) throw new Error("empty public export");',
      'const root = await import("@understand-code/durable-object-provider-contracts");',
      'if (root.DurableObjectIdentityProviderIdV1Schema.parse("durable-object-provider:native-fs") !== "durable-object-provider:native-fs") throw new Error("reader ID schema failed");',
      'const providerError = await import("@understand-code/durable-object-provider-contracts/provider-error");',
      'const providerRegistry = await import("@understand-code/durable-object-provider-contracts/provider-registry");',
      'const unavailable = providerError.createProviderUnavailableToolErrorV1("unavailable");',
      'if (providerError.ProviderUnavailableToolErrorV1Schema.parse(unavailable).details.reason !== "unavailable") throw new Error("provider error export failed");',
      'const schemaUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/schemas/v1/canonical-byte-string.schema.json"));',
      'const providerErrorSchemaUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/schemas/v1/provider-unavailable-tool-error.schema.json"));',
      'const goldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/manifest.json"));',
      'const providerErrorFixtureUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/reference/provider-unavailable-tool-errors.json"));',
      'const publicKeyDigestGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/ed25519-public-key-digest-v1.json"));',
      'const strictEd25519ManifestUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json"));',
      'const bootstrapTrustBundleUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/provider/bootstrap-trust-bundle-v1.json"));',
      'const bootstrapTrustGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json"));',
      'const bootstrapTrustInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-bootstrap-structure-crypto-v1.json"));',
      'const rootHistoryGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-registry-root-history-v1.json"));',
      'const rootHistoryInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-registry-root-history-v1.json"));',
      'const registryManifestGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json"));',
      'const registryManifestInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.json"));',
      'const registryManifestInvalidRecipeUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.recipe-dialect.md"));',
      `if (await realpath(fileURLToPath(strictEd25519ManifestUrl)) !== ${JSON.stringify(installedStrictManifestPath)}) throw new Error("strict manifest resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(bootstrapTrustBundleUrl)) !== ${JSON.stringify(installedBootstrapBundlePath)}) throw new Error("bootstrap Bundle resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(bootstrapTrustGoldenUrl)) !== ${JSON.stringify(installedBootstrapGoldenPath)}) throw new Error("bootstrap golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(bootstrapTrustInvalidUrl)) !== ${JSON.stringify(installedBootstrapInvalidPath)}) throw new Error("bootstrap invalid manifest resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(rootHistoryGoldenUrl)) !== ${JSON.stringify(installedRootHistoryGoldenPath)}) throw new Error("root history golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(rootHistoryInvalidUrl)) !== ${JSON.stringify(installedRootHistoryInvalidPath)}) throw new Error("root history invalid manifest resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(registryManifestGoldenUrl)) !== ${JSON.stringify(installedRegistryManifestGoldenPath)}) throw new Error("Registry Manifest golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(registryManifestInvalidUrl)) !== ${JSON.stringify(installedRegistryManifestInvalidPath)}) throw new Error("Registry Manifest invalid corpus resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(registryManifestInvalidRecipeUrl)) !== ${JSON.stringify(installedRegistryManifestInvalidRecipePath)}) throw new Error("Registry Manifest invalid recipe resolved outside the exact installed path");`,
      'const schema = JSON.parse(await readFile(schemaUrl, "utf8"));',
      'const providerErrorSchema = JSON.parse(await readFile(providerErrorSchemaUrl, "utf8"));',
      'const golden = JSON.parse(await readFile(goldenUrl, "utf8"));',
      'const providerErrorFixture = JSON.parse(await readFile(providerErrorFixtureUrl, "utf8"));',
      'const publicKeyDigestGolden = JSON.parse(await readFile(publicKeyDigestGoldenUrl, "utf8"));',
      'const strictEd25519ManifestBytes = new Uint8Array(await readFile(strictEd25519ManifestUrl));',
      'const bootstrapTrustBundleBytes = new Uint8Array(await readFile(bootstrapTrustBundleUrl));',
      'const bootstrapTrustGoldenBytes = new Uint8Array(await readFile(bootstrapTrustGoldenUrl));',
      'const bootstrapTrustInvalidBytes = new Uint8Array(await readFile(bootstrapTrustInvalidUrl));',
      'const rootHistoryGoldenBytes = new Uint8Array(await readFile(rootHistoryGoldenUrl));',
      'const rootHistoryInvalidBytes = new Uint8Array(await readFile(rootHistoryInvalidUrl));',
      'const registryManifestGoldenBytes = new Uint8Array(await readFile(registryManifestGoldenUrl));',
      'const registryManifestInvalidBytes = new Uint8Array(await readFile(registryManifestInvalidUrl));',
      'const registryManifestInvalidRecipe = await readFile(registryManifestInvalidRecipeUrl, "utf8");',
      'const strictEd25519Manifest = JSON.parse(new TextDecoder().decode(strictEd25519ManifestBytes));',
      'if (schema.$id !== "urn:understand-code:provider-contract:schema:v1:canonical-byte-string") throw new Error("packed schema missing");',
      'if (providerErrorSchema.$id !== "urn:understand-code:provider-contract:schema:v1:provider-unavailable-tool-error") throw new Error("packed provider error schema missing");',
      'if (golden.profile !== "rfc8785-jcs-safe-integer-v1") throw new Error("packed golden manifest missing");',
      'if (providerErrorFixture.cases.length !== 6) throw new Error("packed provider error fixture missing");',
      'const cryptoHost = { sha256(message) { return new Uint8Array(createHash("sha256").update(message).digest()); }, hmacSha256(key, message) { return new Uint8Array(createHmac("sha256", key).update(message).digest()); } };',
      'await root.verifyProviderEd25519PublicKeyDigestGoldenManifestV1(publicKeyDigestGolden, cryptoHost);',
      'if (strictEd25519Manifest.payload.cases.length !== 28) throw new Error("packed strict Ed25519 manifest missing");',
      'const strictEd25519 = await import("@understand-code/durable-object-provider-contracts/strict-ed25519");',
      'const strictConformance = await import("@understand-code/durable-object-provider-contracts/strict-ed25519-conformance");',
      'let pointCalls = 0;',
      'let verifyCalls = 0;',
      'const strictHost = { verificationProfile: strictEd25519.STRICT_ED25519_VERIFICATION_PROFILE_V1, validatePrimeSubgroupPoint(point) { pointCalls += 1; return strictEd25519.validatePrimeSubgroupPoint(point); }, verifyRawEd25519(publicKey, message, signature) { verifyCalls += 1; return strictEd25519.verifyRawEd25519(publicKey, message, signature); } };',
      'const resourceHost = { readFixedSignedPackageResource(path, maxBytes) { if (path !== strictConformance.PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 || strictEd25519ManifestBytes.byteLength > maxBytes) throw new Error("invalid resource request"); return strictEd25519ManifestBytes; } };',
      'const strictCapability = await strictConformance.attestProviderStrictEd25519CryptoHostV1({ host: strictHost, resourceHost });',
      'if (strictConformance.getProviderStrictEd25519CryptoCapabilityBytesV1(strictCapability).byteLength === 0) throw new Error("packed strict Ed25519 attestation failed");',
      'const bootstrapTrustGoldenValidation = await root.verifyProviderBootstrapTrustGoldenManifestResourceV1(bootstrapTrustGoldenBytes, strictCapability);',
      'if (bootstrapTrustGoldenValidation.authority !== "none_structure_only" || bootstrapTrustGoldenValidation.manifest.vectors.recoveryKeyIds.length !== 3) throw new Error("packed bootstrap trust golden failed");',
      'const bootstrapTrustInvalidValidation = root.verifyProviderBootstrapTrustInvalidManifestResourceV1(bootstrapTrustInvalidBytes);',
      'if (bootstrapTrustInvalidValidation.authority !== "none_rejection_only" || bootstrapTrustInvalidValidation.manifest.cases.length !== 51) throw new Error("packed bootstrap trust invalid manifest failed");',
      'if (bootstrapTrustInvalidValidation.manifest.cases[0].witnesses[0].recipe.dialect !== "provider_bootstrap_invalid_recipe_v1" || bootstrapTrustInvalidValidation.manifest.cases[50].witnesses[0].recipe.deterministicSeed.seedHex !== "4444444444444444444444444444444444444444444444444444444444444444") throw new Error("packed bootstrap trust invalid recipes failed");',
      'if (bootstrapTrustInvalidValidation.manifest.cases[41].witnesses[5].recipe.operands[1] !== "alternate_root_key_id=661166fa4208cb1d325f30") throw new Error("packed prefix-mismatch recipe is not self-contained");',
      'const deterministicVector = bootstrapTrustGoldenValidation.manifest.vectors.deterministicRootSelfSignatureSigning;',
      'const deterministicPrivateKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(deterministicVector.rfc8032TestSeedHex, "hex")]), format: "der", type: "pkcs8" });',
      'const deterministicSpki = createPublicKey(deterministicPrivateKey).export({ format: "der", type: "spki" });',
      'if (deterministicSpki.subarray(-32).toString("hex") !== deterministicVector.expected.rawPublicKeyHex || sign(null, Buffer.from(deterministicVector.expected.canonicalMessageUtf8Hex, "hex"), deterministicPrivateKey).toString("hex") !== deterministicVector.expected.rawSignatureHex) throw new Error("packed deterministic signing golden failed");',
      'const bootstrapValidation = await root.validateProviderBootstrapTrustBundleStructureV1({ bundleEnvelopeBytes: bootstrapTrustBundleBytes, strictManifestEnvelopeBytes: strictEd25519ManifestBytes, strictCryptoCapability: strictCapability });',
      'if (bootstrapValidation.authority !== "none_structure_only" || bootstrapValidation.bundleEnvelope.contentDigest !== root.PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1) throw new Error("packed bootstrap trust validation failed");',
      'if (pointCalls !== 62 || verifyCalls !== 31) throw new Error(`packed bootstrap crypto calls: ${pointCalls}/${verifyCalls}`);',
      'const rootHistoryGolden = providerRegistry.verifyProviderRegistryRootHistoryGoldenManifestResourceV1(rootHistoryGoldenBytes);',
      'const rootHistoryInvalid = providerRegistry.verifyProviderRegistryRootHistoryInvalidManifestResourceV1(rootHistoryInvalidBytes);',
      'if (rootHistoryGolden.fixtureAuthority !== "none_structure_and_history_only" || rootHistoryGolden.rootMetadataHistory.length !== 3) throw new Error("packed root history golden failed");',
      'if (rootHistoryInvalid.fixtureAuthority !== "none_rejection_only" || rootHistoryInvalid.cases.length !== 31) throw new Error("packed root history invalid manifest failed");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const rootHistoryValidation = await providerRegistry.validateProviderRegistryRootMetadataHistoryV1({ bootstrapTrustBundle: rootHistoryGolden.bootstrapTrustBundle, rootMetadataHistory: rootHistoryGolden.rootMetadataHistory, strictCryptoCapability: strictCapability });',
      'if (rootHistoryValidation.authority !== "none_structure_and_history_only" || rootHistoryValidation.retainedRootMetadataGenerationCount !== 3 || rootHistoryValidation.currentRootMetadata.rootGeneration !== 3) throw new Error("packed root history validation failed");',
      'if (pointCalls !== 11 || verifyCalls !== 9) throw new Error(`packed root history crypto calls: ${pointCalls}/${verifyCalls}`);',
      'const latestRootEnvelope = rootHistoryGolden.rootMetadataHistory[2];',
      'const latestRootLocator = providerRegistry.buildProviderRegistryRootMetadataRelativePathV1({ locatorProfile: providerRegistry.PROVIDER_REGISTRY_ROOT_METADATA_LOCATOR_PROFILE_V1, rootGeneration: latestRootEnvelope.rootGeneration, rootKeyId: latestRootEnvelope.rootKeyId });',
      'if (latestRootLocator !== rootHistoryGolden.expected.vectors[2].locator) throw new Error("packed root history locator failed");',
      'if (root.validateProviderRegistryManifestHistoryV1 !== providerRegistry.validateProviderRegistryManifestHistoryV1 || root.verifyProviderRegistryManifestHistoryGoldenResourceV1 !== providerRegistry.verifyProviderRegistryManifestHistoryGoldenResourceV1 || root.verifyProviderRegistryManifestHistoryInvalidResourceV1 !== providerRegistry.verifyProviderRegistryManifestHistoryInvalidResourceV1) throw new Error("root/provider-registry Registry exports diverged");',
      'if (registryManifestGoldenBytes.byteLength !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || createHash("sha256").update(registryManifestGoldenBytes).digest("hex") !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1) throw new Error("packed Registry golden raw anchor failed");',
      'const registryGolden = providerRegistry.verifyProviderRegistryManifestHistoryGoldenResourceV1(registryManifestGoldenBytes);',
      'const registrySemanticDigest = `sha256:${createHash("sha256").update(root.canonicalizeJcsSafeIntegerUtf8V1([providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1, registryGolden])).digest("hex")}`;',
      'if (registrySemanticDigest !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 || registryGolden.fixtureAuthority !== "none_registry_structure_and_history_only" || registryGolden.registryManifestHistory.length !== 7) throw new Error("packed Registry golden semantic anchor failed");',
      'if (registryManifestInvalidBytes.byteLength !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1 || createHash("sha256").update(registryManifestInvalidBytes).digest("hex") !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1) throw new Error("packed Registry invalid raw anchor failed");',
      'const registryInvalid = providerRegistry.verifyProviderRegistryManifestHistoryInvalidResourceV1(registryManifestInvalidBytes);',
      'const registryInvalidSemanticDigest = `sha256:${createHash("sha256").update(root.canonicalizeJcsSafeIntegerUtf8V1([providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1, registryInvalid])).digest("hex")}`;',
      'if (registryInvalidSemanticDigest !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1 || registryInvalid.fixtureAuthority !== "none_rejection_only" || registryInvalid.caseCount !== 89 || registryInvalid.cases.length !== 89 || registryInvalid.caseIds.length !== 89 || new Set(registryInvalid.caseIds).size !== 89 || JSON.stringify(registryInvalid.caseIds) !== JSON.stringify(providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1)) throw new Error("packed Registry invalid semantic or case closure failed");',
      'const registryInvalidMaterializedRequestDigests = registryInvalid.cases.map((invalidCase, index) => { if (invalidCase.caseId !== registryInvalid.caseIds[index]) throw new Error("packed Registry materialized request case alignment failed"); return invalidCase.expected.materializedRequestSemanticDigest; });',
      'if (root.PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1 !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1 || registryInvalid.materializedRequestSemanticDomain !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1 || registryInvalidMaterializedRequestDigests.length !== 89 || new Set(registryInvalidMaterializedRequestDigests).size !== 89 || registryInvalidMaterializedRequestDigests.some((digest) => !/^sha256:[0-9a-f]{64}$/u.test(digest))) throw new Error("packed Registry materialized request semantic digest closure failed");',
      'if (registryInvalid.goldenDependency.resourcePath !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1 || registryInvalid.goldenDependency.resourceByteLength !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || registryInvalid.goldenDependency.resourceSha256Hex !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1 || registryInvalid.goldenDependency.semanticContentDigest !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1) throw new Error("packed Registry invalid golden dependency drifted");',
      'const packedRegistryNegativeCaseIds = ["envelope-extra-field", "manifest-signature-bitflip", "runtime-signature-bitflip"];',
      'if (!packedRegistryNegativeCaseIds.every((caseId) => registryInvalid.caseIds.includes(caseId)) || !registryManifestInvalidRecipe.includes(registryInvalid.mutationRecipeDialect) || !registryManifestInvalidRecipe.includes(registryInvalid.goldenDependency.resourcePath) || !registryManifestInvalidRecipe.includes("ProviderRegistryManifestHistoryValidationError")) throw new Error("packed Registry invalid recipe contract failed");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const registryValidation = await providerRegistry.validateProviderRegistryManifestHistoryV1({ installationIdentityGenerationId: registryGolden.installationIdentityGenerationId, bootstrapTrustBundle: registryGolden.bootstrapTrustBundle, rootMetadataHistory: registryGolden.rootMetadataHistory, registryManifestHistory: registryGolden.registryManifestHistory, strictCryptoCapability: strictCapability });',
      'if (registryValidation.authority !== "none_registry_structure_and_history_only" || registryValidation.retainedRegistryManifestGenerationCount !== 7 || registryValidation.currentRegistryManifest.contentDigest !== registryGolden.expected.currentRegistryManifest.contentDigest) throw new Error("packed Registry history validation failed");',
      'if (pointCalls !== 24 || verifyCalls !== 38) throw new Error(`packed Registry history crypto calls: ${pointCalls}/${verifyCalls}`);',
      'async function expectPackedRegistryRejection(registryManifestHistory, label) { try { await providerRegistry.validateProviderRegistryManifestHistoryV1({ installationIdentityGenerationId: registryGolden.installationIdentityGenerationId, bootstrapTrustBundle: registryGolden.bootstrapTrustBundle, rootMetadataHistory: registryGolden.rootMetadataHistory, registryManifestHistory, strictCryptoCapability: strictCapability }); } catch (error) { if (!(error instanceof providerRegistry.ProviderRegistryManifestHistoryValidationError) || error.name !== "ProviderRegistryManifestHistoryValidationError" || error.code !== "provider_unavailable" || error.reason !== "attestation_invalid" || error.message !== "Provider registry manifest history validation failed") throw new Error(`packed Registry negative escaped opaque boundary: ${label}`, { cause: error }); return; } throw new Error(`packed Registry negative accepted: ${label}`); }',
      'const packedSchemaExtraField = structuredClone(registryGolden.registryManifestHistory);',
      'packedSchemaExtraField[6].unexpectedField = true;',
      'await expectPackedRegistryRejection(packedSchemaExtraField, "envelope-extra-field");',
      'const packedManifestSignatureBitflip = structuredClone(registryGolden.registryManifestHistory);',
      'const packedManifestSignature = packedManifestSignatureBitflip[6].payload.manifestSignature;',
      'packedManifestSignatureBitflip[6].payload.manifestSignature = `${packedManifestSignature.slice(0, -1)}${packedManifestSignature.endsWith("0") ? "1" : "0"}`;',
      'await expectPackedRegistryRejection(packedManifestSignatureBitflip, "manifest-signature-bitflip");',
      'const packedRuntimeSignatureBitflip = structuredClone(registryGolden.registryManifestHistory);',
      'const packedRuntimeSignature = packedRuntimeSignatureBitflip[0].payload.members[0].registryEntry.runtimeAttestation.payload.registrySignature;',
      'packedRuntimeSignatureBitflip[0].payload.members[0].registryEntry.runtimeAttestation.payload.registrySignature = `${packedRuntimeSignature.slice(0, -1)}${packedRuntimeSignature.endsWith("0") ? "1" : "0"}`;',
      'await expectPackedRegistryRejection(packedRuntimeSignatureBitflip, "runtime-signature-bitflip");',
      'if (providerRegistry.StoreFilenameKeyV1Schema.parse("id-c4") !== "id-c4" || providerRegistry.decodeShortStoreFilenameKeyV1("id-c4") !== "a") throw new Error("packed lowercase base32hex filename codec failed");',
      'try { await import("@understand-code/durable-object-provider-contracts/domain-crypto"); throw new Error("private crypto helper exported"); } catch (error) { if (error?.message === "private crypto helper exported") throw error; }',
      'for (const privateSpecifier of ["@understand-code/durable-object-provider-contracts/provider-registry-records", "@understand-code/durable-object-provider-contracts/provider-registry-manifest-history"]) { try { await import(privateSpecifier); throw new Error(`private deep import exported: ${privateSpecifier}`); } catch (error) { if (error?.message?.startsWith("private deep import exported:")) throw error; } }',
    ].join("\n"),
    "utf8",
  );
  run(process.execPath, [runtimeProbe], { cwd: consumerRoot });

  const typeProbe = join(consumerRoot, "type-probe.mts");
  await writeFile(
    typeProbe,
    [
      'import { DurableObjectIdentityProviderIdV1Schema, DurableObjectIdentityProviderSlugV1Schema, createDurableObjectIdentityProviderIdV1, validateProviderRegistryManifestHistoryV1, verifyProviderRegistryManifestHistoryInvalidResourceV1 } from "@understand-code/durable-object-provider-contracts";',
      'import { createProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'import type { ProviderCapabilityFailureReasonV1, ProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'import { ProviderRegistryManifestHistoryGoldenManifestV1Schema, ProviderRegistryManifestHistoryInvalidManifestV1Schema, StoreFilenameKeyV1Schema, buildProviderRegistryRootMetadataRelativePathV1 } from "@understand-code/durable-object-provider-contracts/provider-registry";',
      'import type { ProviderRegistryManifestHistoryGoldenManifestV1, ProviderRegistryManifestHistoryInvalidManifestV1, ProviderRegistryManifestHistoryValidationV1, ProviderRegistryRootMetadataHistoryValidationV1, ProviderRegistryRootMetadataRelativePathV1, StoreFilenameKeyV1, ValidateProviderRegistryManifestHistoryV1Input } from "@understand-code/durable-object-provider-contracts/provider-registry";',
      'import type { Ed25519PublicKeyDigestV1, ContentDigestV1, ProviderBootstrapTrustBundleStructureValidationV1, ProviderBootstrapTrustGoldenManifestValidationV1, ProviderBootstrapTrustInvalidManifestValidationV1, ProviderStrictEd25519FixedResourceHostV1 } from "@understand-code/durable-object-provider-contracts";',
      'const slug = DurableObjectIdentityProviderSlugV1Schema.parse("native-fs");',
      'const id = createDurableObjectIdentityProviderIdV1(slug);',
      'DurableObjectIdentityProviderIdV1Schema.parse(id);',
      'const reason: ProviderCapabilityFailureReasonV1 = "attestation_invalid";',
      'const providerError: ProviderUnavailableToolErrorV1 = createProviderUnavailableToolErrorV1(reason);',
      'declare const rawKeyDigest: Ed25519PublicKeyDigestV1;',
      'declare const contentDigest: ContentDigestV1;',
      'declare const resourceHost: ProviderStrictEd25519FixedResourceHostV1;',
      'declare const bootstrapValidation: ProviderBootstrapTrustBundleStructureValidationV1;',
      'declare const goldenValidation: ProviderBootstrapTrustGoldenManifestValidationV1;',
      'declare const invalidValidation: ProviderBootstrapTrustInvalidManifestValidationV1;',
      'declare const rootHistoryValidation: ProviderRegistryRootMetadataHistoryValidationV1;',
      'declare const registryHistoryInput: ValidateProviderRegistryManifestHistoryV1Input;',
      'declare const registryGoldenManifest: ProviderRegistryManifestHistoryGoldenManifestV1;',
      'declare const registryInvalidBytes: Uint8Array;',
      'const registryGoldenParsed = ProviderRegistryManifestHistoryGoldenManifestV1Schema.parse(registryGoldenManifest);',
      'const registryHistoryValidation: Promise<ProviderRegistryManifestHistoryValidationV1> = validateProviderRegistryManifestHistoryV1(registryHistoryInput);',
      'const registryInvalidManifest: ProviderRegistryManifestHistoryInvalidManifestV1 = ProviderRegistryManifestHistoryInvalidManifestV1Schema.parse(verifyProviderRegistryManifestHistoryInvalidResourceV1(registryInvalidBytes));',
      'const registryMaterializedRequestDigest: ContentDigestV1 = registryInvalidManifest.cases[0]!.expected.materializedRequestSemanticDigest;',
      'const filenameKey: StoreFilenameKeyV1 = StoreFilenameKeyV1Schema.parse("id-c4");',
      'const rootMetadataPath: ProviderRegistryRootMetadataRelativePathV1 = buildProviderRegistryRootMetadataRelativePathV1({ locatorProfile: "installation_provider_registry_root_metadata_v1", rootGeneration: 1, rootKeyId: "0000000000000000000000" });',
      'void rawKeyDigest;',
      'void resourceHost;',
      'const structureAuthority: "none_structure_only" = bootstrapValidation.authority;',
      'const fixtureAuthority: "none_structure_only" = goldenValidation.authority;',
      'const invalidAuthority: "none_rejection_only" = invalidValidation.authority;',
      'const rootHistoryAuthority: "none_structure_and_history_only" = rootHistoryValidation.authority;',
      'void structureAuthority;',
      'void fixtureAuthority;',
      'void invalidAuthority;',
      'void rootHistoryAuthority;',
      'void registryGoldenParsed;',
      'void registryHistoryValidation;',
      'void registryInvalidManifest;',
      'void registryMaterializedRequestDigest;',
      'void filenameKey;',
      'void rootMetadataPath;',
      'void providerError;',
      '// @ts-expect-error a raw string has not passed the branded slug schema',
      'createDurableObjectIdentityProviderIdV1("native-fs");',
      '// @ts-expect-error provider failure reasons are closed',
      'createProviderUnavailableToolErrorV1("network_error");',
      '// @ts-expect-error raw-key and content digest brands are independent',
      'const wrongDigest: Ed25519PublicKeyDigestV1 = contentDigest;',
      'void wrongDigest;',
    ].join("\n"),
    "utf8",
  );
  run(
    process.execPath,
    [
      typescriptCli,
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      typeProbe,
    ],
    { cwd: consumerRoot },
  );

  const packedStrictEd25519ManifestText = await readFile(
    join(
      installedRoot,
      "provider",
      "ed25519-strict-host-conformance-v1.json",
    ),
    "utf8",
  );
  const packedBootstrapTrustBundleText = await readFile(
    join(
      installedRoot,
      "provider",
      "bootstrap-trust-bundle-v1.json",
    ),
    "utf8",
  );
  const packedBootstrapTrustGoldenText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-bootstrap-structure-crypto-v1.json",
    ),
    "utf8",
  );
  const packedBootstrapTrustInvalidText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-bootstrap-structure-crypto-v1.json",
    ),
    "utf8",
  );
  const packedRootHistoryGoldenText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-registry-root-history-v1.json",
    ),
    "utf8",
  );
  const packedRootHistoryInvalidText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-root-history-v1.json",
    ),
    "utf8",
  );
  const packedRegistryManifestGoldenText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-registry-entry-manifest-history-v1.json",
    ),
    "utf8",
  );
  const packedRegistryManifestInvalidText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-entry-manifest-history-v1.json",
    ),
    "utf8",
  );
  await writeFile(
    join(consumerRoot, "browser-entry.js"),
    [
      'import { ProviderUnavailableToolErrorV1Schema, createProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'import { PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1, validateProviderBootstrapTrustBundleStructureV1, verifyProviderBootstrapTrustGoldenManifestResourceV1, verifyProviderBootstrapTrustInvalidManifestResourceV1 } from "@understand-code/durable-object-provider-contracts";',
      'import { PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1, PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1, PROVIDER_REGISTRY_ROOT_METADATA_LOCATOR_PROFILE_V1, ProviderRegistryManifestHistoryValidationError, buildProviderRegistryRootMetadataRelativePathV1, validateProviderRegistryManifestHistoryV1, validateProviderRegistryRootMetadataHistoryV1, verifyProviderRegistryManifestHistoryGoldenResourceV1, verifyProviderRegistryManifestHistoryInvalidResourceV1, verifyProviderRegistryRootHistoryGoldenManifestResourceV1, verifyProviderRegistryRootHistoryInvalidManifestResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-registry";',
      'import { STRICT_ED25519_VERIFICATION_PROFILE_V1, validatePrimeSubgroupPoint, verifyRawEd25519 } from "@understand-code/durable-object-provider-contracts/strict-ed25519";',
      'import { PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1, PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1, attestProviderStrictEd25519CryptoHostV1, getProviderStrictEd25519CryptoCapabilityBytesV1 } from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";',
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as providerContractBrowserModule${index} from ${JSON.stringify(specifier)};`,
      ),
      `const manifestResourceBytes = new TextEncoder().encode(${JSON.stringify(packedStrictEd25519ManifestText)});`,
      `const bundleResourceBytes = new TextEncoder().encode(${JSON.stringify(packedBootstrapTrustBundleText)});`,
      `const bootstrapTrustGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedBootstrapTrustGoldenText)});`,
      `const bootstrapTrustInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedBootstrapTrustInvalidText)});`,
      `const rootHistoryGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedRootHistoryGoldenText)});`,
      `const rootHistoryInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedRootHistoryInvalidText)});`,
      `const registryManifestGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedRegistryManifestGoldenText)});`,
      `const registryManifestInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedRegistryManifestInvalidText)});`,
      'let pointCalls = 0;',
      'let verifyCalls = 0;',
      'const strictHost = {',
      '  verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,',
      '  validatePrimeSubgroupPoint(point) { pointCalls += 1; return validatePrimeSubgroupPoint(point); },',
      '  verifyRawEd25519(publicKey, message, signature) { verifyCalls += 1; return verifyRawEd25519(publicKey, message, signature); },',
      '};',
      'const resourceHost = {',
      '  readFixedSignedPackageResource(path, maxBytes) {',
      '    if (path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 || maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1 || manifestResourceBytes.byteLength > maxBytes) throw new Error("invalid fixed resource request");',
      '    return manifestResourceBytes;',
      '  },',
      '};',
      'const strictCapability = await attestProviderStrictEd25519CryptoHostV1({ host: strictHost, resourceHost });',
      'const bootstrapValidation = await validateProviderBootstrapTrustBundleStructureV1({ bundleEnvelopeBytes: bundleResourceBytes, strictManifestEnvelopeBytes: manifestResourceBytes, strictCryptoCapability: strictCapability });',
      'if (bootstrapValidation.bundleEnvelope.contentDigest !== PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1) throw new Error("browser bootstrap trust digest mismatch");',
      'const bootstrapGoldenValidation = await verifyProviderBootstrapTrustGoldenManifestResourceV1(bootstrapTrustGoldenBytes, strictCapability);',
      'if (bootstrapGoldenValidation.authority !== "none_structure_only" || bootstrapGoldenValidation.manifest.vectors.recoveryKeyIds.length !== 3) throw new Error("browser bootstrap golden mismatch");',
      'const bootstrapInvalidValidation = verifyProviderBootstrapTrustInvalidManifestResourceV1(bootstrapTrustInvalidBytes);',
      'if (bootstrapInvalidValidation.authority !== "none_rejection_only" || bootstrapInvalidValidation.manifest.cases.length !== 51) throw new Error("browser bootstrap invalid manifest mismatch");',
      'if (bootstrapInvalidValidation.manifest.cases[0].witnesses[0].recipe.dialect !== "provider_bootstrap_invalid_recipe_v1" || bootstrapInvalidValidation.manifest.cases[50].witnesses[0].recipe.deterministicSeed.seedHex !== "4444444444444444444444444444444444444444444444444444444444444444") throw new Error("browser bootstrap invalid recipes mismatch");',
      'if (bootstrapInvalidValidation.manifest.cases[41].witnesses[5].recipe.operands[1] !== "alternate_root_key_id=661166fa4208cb1d325f30") throw new Error("browser prefix-mismatch recipe is not self-contained");',
      'const bootstrapPointCalls = pointCalls;',
      'const bootstrapVerifyCalls = verifyCalls;',
      'const rootHistoryGolden = verifyProviderRegistryRootHistoryGoldenManifestResourceV1(rootHistoryGoldenBytes);',
      'const rootHistoryInvalid = verifyProviderRegistryRootHistoryInvalidManifestResourceV1(rootHistoryInvalidBytes);',
      'if (rootHistoryGolden.fixtureAuthority !== "none_structure_and_history_only" || rootHistoryGolden.rootMetadataHistory.length !== 3) throw new Error("browser root history golden mismatch");',
      'if (rootHistoryInvalid.fixtureAuthority !== "none_rejection_only" || rootHistoryInvalid.cases.length !== 31) throw new Error("browser root history invalid manifest mismatch");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const rootHistoryValidation = await validateProviderRegistryRootMetadataHistoryV1({ bootstrapTrustBundle: rootHistoryGolden.bootstrapTrustBundle, rootMetadataHistory: rootHistoryGolden.rootMetadataHistory, strictCryptoCapability: strictCapability });',
      'if (rootHistoryValidation.authority !== "none_structure_and_history_only" || rootHistoryValidation.retainedRootMetadataGenerationCount !== 3 || rootHistoryValidation.currentRootMetadata.rootGeneration !== 3) throw new Error("browser root history validation mismatch");',
      'const rootHistoryPointCalls = pointCalls;',
      'const rootHistoryVerifyCalls = verifyCalls;',
      'const latestRootEnvelope = rootHistoryGolden.rootMetadataHistory[2];',
      'const latestRootLocator = buildProviderRegistryRootMetadataRelativePathV1({ locatorProfile: PROVIDER_REGISTRY_ROOT_METADATA_LOCATOR_PROFILE_V1, rootGeneration: latestRootEnvelope.rootGeneration, rootKeyId: latestRootEnvelope.rootKeyId });',
      'if (latestRootLocator !== rootHistoryGolden.expected.vectors[2].locator) throw new Error("browser root history locator mismatch");',
      'if (registryManifestGoldenBytes.byteLength !== PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || !/^[0-9a-f]{64}$/.test(PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1) || PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1 !== "provider-registry-entry-manifest-history-golden-manifest-v1" || !PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1.startsWith("sha256:")) throw new Error("browser Registry golden anchor exports mismatch");',
      'const registryGolden = verifyProviderRegistryManifestHistoryGoldenResourceV1(registryManifestGoldenBytes);',
      'if (registryGolden.fixtureAuthority !== "none_registry_structure_and_history_only" || registryGolden.registryManifestHistory.length !== 7) throw new Error("browser Registry golden mismatch");',
      'if (registryManifestInvalidBytes.byteLength !== PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1 || !/^[0-9a-f]{64}$/.test(PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1) || PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1 !== "provider-registry-manifest-history-invalid-manifest-v1" || !PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1.startsWith("sha256:")) throw new Error("browser Registry invalid anchor exports mismatch");',
      'const registryInvalid = verifyProviderRegistryManifestHistoryInvalidResourceV1(registryManifestInvalidBytes);',
      'if (registryInvalid.fixtureAuthority !== "none_rejection_only" || registryInvalid.caseCount !== 89 || registryInvalid.cases.length !== 89 || registryInvalid.caseIds.length !== 89 || new Set(registryInvalid.caseIds).size !== 89 || JSON.stringify(registryInvalid.caseIds) !== JSON.stringify(PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1)) throw new Error("browser Registry invalid corpus mismatch");',
      'const registryInvalidMaterializedRequestDigests = registryInvalid.cases.map((invalidCase, index) => { if (invalidCase.caseId !== registryInvalid.caseIds[index]) throw new Error("browser Registry materialized request case alignment mismatch"); return invalidCase.expected.materializedRequestSemanticDigest; });',
      'if (registryInvalid.materializedRequestSemanticDomain !== PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1 || registryInvalidMaterializedRequestDigests.length !== 89 || new Set(registryInvalidMaterializedRequestDigests).size !== 89 || registryInvalidMaterializedRequestDigests.some((digest) => !/^sha256:[0-9a-f]{64}$/u.test(digest))) throw new Error("browser Registry materialized request semantic digest closure mismatch");',
      'if (registryInvalid.goldenDependency.resourceByteLength !== PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || registryInvalid.goldenDependency.resourceSha256Hex !== PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1 || registryInvalid.goldenDependency.semanticContentDigest !== PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1) throw new Error("browser Registry invalid golden dependency mismatch");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const registryValidation = await validateProviderRegistryManifestHistoryV1({ installationIdentityGenerationId: registryGolden.installationIdentityGenerationId, bootstrapTrustBundle: registryGolden.bootstrapTrustBundle, rootMetadataHistory: registryGolden.rootMetadataHistory, registryManifestHistory: registryGolden.registryManifestHistory, strictCryptoCapability: strictCapability });',
      'if (registryValidation.authority !== "none_registry_structure_and_history_only" || registryValidation.retainedRegistryManifestGenerationCount !== 7 || registryValidation.currentRegistryManifest.contentDigest !== registryGolden.expected.currentRegistryManifest.contentDigest) throw new Error("browser Registry history validation mismatch");',
      'const registryHistoryPointCalls = pointCalls;',
      'const registryHistoryVerifyCalls = verifyCalls;',
      'let registryNegativeCount = 0;',
      'async function expectRegistryRejection(registryManifestHistory, label) { try { await validateProviderRegistryManifestHistoryV1({ installationIdentityGenerationId: registryGolden.installationIdentityGenerationId, bootstrapTrustBundle: registryGolden.bootstrapTrustBundle, rootMetadataHistory: registryGolden.rootMetadataHistory, registryManifestHistory, strictCryptoCapability: strictCapability }); } catch (error) { if (!(error instanceof ProviderRegistryManifestHistoryValidationError) || error.name !== "ProviderRegistryManifestHistoryValidationError" || error.code !== "provider_unavailable" || error.reason !== "attestation_invalid" || error.message !== "Provider registry manifest history validation failed") throw new Error(`browser Registry negative escaped opaque boundary: ${label}`, { cause: error }); registryNegativeCount += 1; return; } throw new Error(`browser Registry negative accepted: ${label}`); }',
      'const signatureBitflip = structuredClone(registryGolden.registryManifestHistory);',
      'const signature = signatureBitflip[6].payload.manifestSignature;',
      'signatureBitflip[6].payload.manifestSignature = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;',
      'await expectRegistryRejection(signatureBitflip, "Manifest signature bitflip");',
      'const schemaExtraField = structuredClone(registryGolden.registryManifestHistory);',
      'schemaExtraField[6].unexpectedField = true;',
      'await expectRegistryRejection(schemaExtraField, "Envelope extra field");',
      'const digestBitflip = structuredClone(registryGolden.registryManifestHistory);',
      'const digest = digestBitflip[6].contentDigest;',
      'digestBitflip[6].contentDigest = `${digest.slice(0, -1)}${digest.endsWith("0") ? "1" : "0"}`;',
      'await expectRegistryRejection(digestBitflip, "Envelope digest bitflip");',
      'const capabilityBytes = getProviderStrictEd25519CryptoCapabilityBytesV1(strictCapability);',
      'const providerError = createProviderUnavailableToolErrorV1("revoked");',
      'ProviderUnavailableToolErrorV1Schema.parse(providerError);',
      `const publicModules = [${explicitSpecifiers
        .map((_, index) => `providerContractBrowserModule${index}`)
        .join(", ")}];`,
      'if (publicModules.some((module) => Object.keys(module).length === 0)) throw new Error("empty browser public export");',
      'export const browserKatResult = Object.freeze({ pointCalls: bootstrapPointCalls, verifyCalls: bootstrapVerifyCalls, rootHistoryPointCalls, rootHistoryVerifyCalls, registryHistoryPointCalls, registryHistoryVerifyCalls, registryNegativeCount, registryInvalidCaseCount: registryInvalid.caseCount, registryHistoryAuthority: registryValidation.authority, registryManifestCount: registryValidation.retainedRegistryManifestGenerationCount, capabilityByteLength: capabilityBytes.byteLength, bootstrapAuthority: bootstrapValidation.authority, goldenAuthority: bootstrapGoldenValidation.authority, goldenCaseCount: 5 + bootstrapGoldenValidation.manifest.vectors.recoveryKeyIds.length, invalidAuthority: bootstrapInvalidValidation.authority, invalidCaseCount: bootstrapInvalidValidation.manifest.cases.length, rootHistoryAuthority: rootHistoryValidation.authority, rootHistoryGenerationCount: rootHistoryValidation.retainedRootMetadataGenerationCount, rootHistoryInvalidCaseCount: rootHistoryInvalid.cases.length, rootHistoryLocator: latestRootLocator, expectedRootHistoryLocator: rootHistoryGolden.expected.vectors[2].locator, publicModuleCount: publicModules.length, providerReason: providerError.details.reason });',
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(consumerRoot, "vite.config.mjs"),
    [
      'import { resolve } from "node:path";',
      'export default {',
      '  build: {',
      '    target: "es2022",',
      '    outDir: "browser-dist",',
      '    emptyOutDir: true,',
      '    minify: false,',
      '    lib: { entry: resolve("browser-entry.js"), formats: ["es"], fileName: "browser-kat" },',
      '  },',
      '};',
    ].join("\n"),
    "utf8",
  );
  const viteBuildResult = run(
    viteCommand,
    ["build", "--config", "vite.config.mjs"],
    { cwd: consumerRoot },
  );
  const viteBuildOutput = [
    viteBuildResult.stdout,
    viteBuildResult.stderr,
  ].join("\n");
  if (
    /(?:externalized for browser compatibility|__vite-browser-external)/u.test(
      viteBuildOutput,
    )
  ) {
    throw new Error(
      "Vite externalized a Node-only dependency from the browser bundle",
    );
  }
  const browserJavaScriptFiles = (
    await listFiles(join(consumerRoot, "browser-dist"))
  ).filter((filePath) => /\.(?:m?js)$/u.test(filePath));
  if (browserJavaScriptFiles.length === 0) {
    throw new Error("Vite did not emit a browser JavaScript bundle");
  }
  const browserEntryFile = browserJavaScriptFiles.find((filePath) =>
    basename(filePath).startsWith("browser-kat."),
  );
  if (browserEntryFile === undefined) {
    throw new Error("Vite did not emit the browser KAT entry");
  }
  for (const filePath of browserJavaScriptFiles) {
    const source = await readFile(filePath, "utf8");
    const dependency = findBrowserNodeRuntimeDependency(source);
    if (dependency !== undefined) {
      throw new Error(
        `Browser bundle ${basename(filePath)} contains ${dependency}`,
      );
    }
  }
  const browserRuntimeProbe = join(
    consumerRoot,
    "browser-runtime-probe.mjs",
  );
  await writeFile(
    browserRuntimeProbe,
    [
      "delete globalThis.process;",
      "delete globalThis.Buffer;",
      `const { browserKatResult } = await import(${JSON.stringify(`./browser-dist/${basename(browserEntryFile)}`)});`,
      'if (browserKatResult.pointCalls !== 62) throw new Error(`browser KAT+trust point calls: ${browserKatResult.pointCalls}`);',
      'if (browserKatResult.verifyCalls !== 31) throw new Error(`browser KAT+trust verify calls: ${browserKatResult.verifyCalls}`);',
      'if (browserKatResult.rootHistoryPointCalls !== 11) throw new Error(`browser root history point calls: ${browserKatResult.rootHistoryPointCalls}`);',
      'if (browserKatResult.rootHistoryVerifyCalls !== 9) throw new Error(`browser root history verify calls: ${browserKatResult.rootHistoryVerifyCalls}`);',
      'if (browserKatResult.registryHistoryPointCalls !== 24) throw new Error(`browser Registry history point calls: ${browserKatResult.registryHistoryPointCalls}`);',
      'if (browserKatResult.registryHistoryVerifyCalls !== 38) throw new Error(`browser Registry history verify calls: ${browserKatResult.registryHistoryVerifyCalls}`);',
      'if (browserKatResult.registryNegativeCount !== 3) throw new Error(`browser Registry exact negative count: ${browserKatResult.registryNegativeCount}`);',
      'if (browserKatResult.registryInvalidCaseCount !== 89) throw new Error(`browser Registry invalid case count: ${browserKatResult.registryInvalidCaseCount}`);',
      'if (browserKatResult.capabilityByteLength === 0) throw new Error("browser KAT capability is empty");',
      'if (browserKatResult.bootstrapAuthority !== "none_structure_only") throw new Error("browser bootstrap trust exposed authority");',
      'if (browserKatResult.goldenAuthority !== "none_structure_only" || browserKatResult.goldenCaseCount !== 8) throw new Error("browser bootstrap golden exposed authority or lost cases");',
      'if (browserKatResult.invalidAuthority !== "none_rejection_only" || browserKatResult.invalidCaseCount !== 51) throw new Error("browser bootstrap invalid manifest exposed authority or lost cases");',
      'if (browserKatResult.rootHistoryAuthority !== "none_structure_and_history_only" || browserKatResult.rootHistoryGenerationCount !== 3 || browserKatResult.rootHistoryInvalidCaseCount !== 31) throw new Error("browser root history exposed authority or lost cases");',
      'if (browserKatResult.registryHistoryAuthority !== "none_registry_structure_and_history_only" || browserKatResult.registryManifestCount !== 7) throw new Error("browser Registry history exposed authority or lost generations");',
      'if (browserKatResult.rootHistoryLocator !== browserKatResult.expectedRootHistoryLocator) throw new Error("browser root history locator mismatch");',
      `if (browserKatResult.publicModuleCount !== ${explicitSpecifiers.length}) throw new Error("browser public module count mismatch");`,
      'if (browserKatResult.providerReason !== "revoked") throw new Error("browser provider error probe failed");',
    ].join("\n"),
    "utf8",
  );
  run(process.execPath, [browserRuntimeProbe], { cwd: consumerRoot });

  const packedSchemaRelativePaths = await listRelativeSchemaPaths(
    join(installedRoot, "schemas", "v1"),
  );
  assertExactSortedPathSet(
    packedSchemaRelativePaths,
    sourceSchemaRelativePaths,
    "Cold-installed provider schema path set",
  );

  for (const requiredPath of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/bootstrap-trust-bundle.js",
    "dist/bootstrap-trust-bundle.d.ts",
    "dist/bootstrap-trust-golden.js",
    "dist/bootstrap-trust-golden.d.ts",
    "dist/bootstrap-trust-invalid.js",
    "dist/bootstrap-trust-invalid.d.ts",
    "dist/installation-bootstrap-trust.js",
    "dist/installation-bootstrap-trust.d.ts",
    "dist/jcs.js",
    "dist/provider-error.js",
    "dist/provider-error.d.ts",
    "dist/public-key-digest.js",
    "dist/public-key-digest.d.ts",
    "dist/provider-distribution-trust.js",
    "dist/provider-distribution-trust.d.ts",
    "dist/provider-registry-trust.js",
    "dist/provider-registry-trust.d.ts",
    "dist/provider-fixed-locator.js",
    "dist/provider-fixed-locator.d.ts",
    "dist/provider-registry-root-history.js",
    "dist/provider-registry-root-history.d.ts",
    "dist/provider-registry-root-history-fixtures.js",
    "dist/provider-registry-root-history-fixtures.d.ts",
    "dist/provider-registry-root-history-invalid-definitions.js",
    "dist/provider-registry-root-history-invalid-definitions.d.ts",
    "dist/provider-registry-records.js",
    "dist/provider-registry-records.d.ts",
    "dist/provider-registry-manifest-history.js",
    "dist/provider-registry-manifest-history.d.ts",
    "dist/provider-registry-manifest-fixtures.js",
    "dist/provider-registry-manifest-fixtures.d.ts",
    "dist/provider-registry-manifest-invalid-definitions.js",
    "dist/provider-registry-manifest-invalid-definitions.d.ts",
    "dist/provider-registry.js",
    "dist/provider-registry.d.ts",
    "dist/provider-trust-policy.js",
    "dist/provider-trust-policy.d.ts",
    "dist/strict-ed25519.js",
    "dist/strict-ed25519.d.ts",
    "dist/strict-ed25519-conformance.js",
    "dist/strict-ed25519-conformance.d.ts",
    "schemas/v1/canonical-byte-string.schema.json",
    "schemas/v1/ed25519-public-key-digest.schema.json",
    "schemas/v1/ed25519-public-key-digest-golden-manifest.schema.json",
    "schemas/v1/provider-strict-ed25519-adversarial-manifest-envelope.schema.json",
    "schemas/v1/provider-bootstrap-trust-bundle-envelope.schema.json",
    "schemas/v1/provider-bootstrap-trust-golden-manifest.schema.json",
    "schemas/v1/provider-bootstrap-trust-invalid-manifest.schema.json",
    "schemas/v1/short-store-filename-key-syntax.schema.json",
    "schemas/v1/hashed-store-filename-key.schema.json",
    "schemas/v1/store-filename-key-syntax.schema.json",
    "schemas/v1/provider-registry-root-metadata-locator.schema.json",
    "schemas/v1/provider-registry-root-cross-signature-wrapper.schema.json",
    "schemas/v1/provider-registry-root-recovery-signature-wrapper.schema.json",
    "schemas/v1/provider-registry-root-history-golden-manifest.schema.json",
    "schemas/v1/provider-registry-root-history-invalid-manifest.schema.json",
    "schemas/v1/provider-registry-root-history-invalid-stage.schema.json",
    "schemas/v1/provider-registry-root-history-invalid-reason.schema.json",
    "schemas/v1/provider-registry-root-metadata.schema.json",
    "schemas/v1/provider-registry-manifest-locator.schema.json",
    "schemas/v1/provider-registry-manifest-envelope.schema.json",
    "schemas/v1/provider-registry-manifest-history-golden-manifest.schema.json",
    "schemas/v1/provider-registry-manifest-history-invalid-manifest.schema.json",
    "schemas/v1/provider-registry-manifest-history-invalid-stage.schema.json",
    "schemas/v1/provider-registry-manifest-history-invalid-reason.schema.json",
    "schemas/v1/store-durable-object-provider-runtime-attestation.schema.json",
    "schemas/v1/store-durable-object-provider-verification-keys.schema.json",
    "schemas/v1/store-durable-object-provider-registry-entry.schema.json",
    "schemas/v1/provider-signed-distribution-root-binding.schema.json",
    "schemas/v1/installation-identity-bootstrap-trust-fields.schema.json",
    "schemas/v1/provider-unavailable-tool-error.schema.json",
    "fixtures/v1/golden/manifest.json",
    "fixtures/v1/golden/ed25519-public-key-digest-v1.json",
    "fixtures/v1/golden/bootstrap-trust-bundle-v1.json",
    "fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json",
    "fixtures/v1/golden/provider-registry-root-history-v1.json",
    "fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
    "fixtures/v1/invalid/manifest.json",
    "fixtures/v1/invalid/provider-bootstrap-structure-crypto-v1.json",
    "fixtures/v1/invalid/provider-registry-root-history-v1.json",
    "fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.json",
    "fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.recipe-dialect.md",
    "fixtures/v1/invalid/provider-registry-root-history-invalid-recipe-v1.md",
    "fixtures/v1/reference/provider-unavailable-tool-errors.json",
    "fixtures/v1/invalid/provider-unavailable-tool-errors.json",
    "provider/ed25519-strict-host-conformance-v1.json",
    "provider/bootstrap-trust-bundle-v1.json",
    "README.md",
  ]) {
    if (!(await isFile(join(installedRoot, requiredPath)))) {
      throw new Error(`Packed provider contracts are missing ${requiredPath}`);
    }
  }
  for (const forbiddenPath of ["src", "scripts", "test", "node_modules"]) {
    try {
      await stat(join(installedRoot, forbiddenPath));
      throw new Error(`Packed provider contracts contain ${forbiddenPath}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("contain")) throw error;
    }
  }

  process.stdout.write(
    `Verified packed provider contracts with ${explicitSpecifiers.length} public module exports, exact ${packedSchemaRelativePaths.length}-schema source/install parity, browser ESM trust checks for bootstrap (62 point/31 signature), root history (11 point/9 signature), 7-generation Registry history (24 point/38 signature), and 89 anchored Registry invalid recipes/materialized-request digests with 3 exact opaque consumer rejections.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
