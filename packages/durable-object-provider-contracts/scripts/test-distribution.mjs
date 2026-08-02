import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";

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

function packageSpecifier(exportKey) {
  return exportKey === "."
    ? "@understand-code/durable-object-provider-contracts"
    : `@understand-code/durable-object-provider-contracts${exportKey.slice(1)}`;
}

function assertExactResourceMatchPaths(actualPaths, expectedPath, label) {
  if (
    actualPaths.length !== 1 ||
    actualPaths[0] !== expectedPath
  ) {
    throw new Error(
      `${label} must have exactly one packed path ${expectedPath}; found ${actualPaths.join(", ")}`,
    );
  }
}

for (const regressionPaths of [
  [],
  [
    "provider/bootstrap-trust-bundle-v1.json",
    "provider/bootstrap-trust-bundle-alias.json",
  ],
]) {
  let rejected = false;
  try {
    assertExactResourceMatchPaths(
      regressionPaths,
      "provider/bootstrap-trust-bundle-v1.json",
      "regression bootstrap resource",
    );
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("Exact-one packed resource detector regression");
  }
}

const temporaryRoot = await mkdtemp(
  join(tmpdir(), "understand-code-provider-contracts-distribution-"),
);

try {
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

  run(npmCommand, ["pack", ".", "--pack-destination", packRoot, "--silent"], {
    cwd: cleanPackageRoot,
  });
  const tarballs = (await readdir(packRoot))
    .filter((name) => name.endsWith(".tgz"))
    .sort();
  if (tarballs.length !== 1) {
    throw new Error(`Expected one package tarball, found ${tarballs.join(", ")}`);
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
  const manifest = JSON.parse(
    await readFile(join(installedRoot, "package.json"), "utf8"),
  );
  const explicitSpecifiers = Object.keys(manifest.exports)
    .filter((key) => !key.includes("*"))
    .map(packageSpecifier);

  const runtimeProbe = join(consumerRoot, "runtime-probe.mjs");
  await writeFile(
    runtimeProbe,
    [
      'import { readFile } from "node:fs/promises";',
      'import { createHash, createHmac, createPrivateKey, createPublicKey, sign } from "node:crypto";',
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as providerContractModule${index} from ${JSON.stringify(specifier)};`,
      ),
      `const modules = [${explicitSpecifiers.map((_, index) => `providerContractModule${index}`).join(", ")}];`,
      'if (modules.some((module) => Object.keys(module).length === 0)) throw new Error("empty public export");',
      'const root = await import("@understand-code/durable-object-provider-contracts");',
      'if (root.DurableObjectIdentityProviderIdV1Schema.parse("durable-object-provider:native-fs") !== "durable-object-provider:native-fs") throw new Error("reader ID schema failed");',
      'const providerError = await import("@understand-code/durable-object-provider-contracts/provider-error");',
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
      'const schema = JSON.parse(await readFile(schemaUrl, "utf8"));',
      'const providerErrorSchema = JSON.parse(await readFile(providerErrorSchemaUrl, "utf8"));',
      'const golden = JSON.parse(await readFile(goldenUrl, "utf8"));',
      'const providerErrorFixture = JSON.parse(await readFile(providerErrorFixtureUrl, "utf8"));',
      'const publicKeyDigestGolden = JSON.parse(await readFile(publicKeyDigestGoldenUrl, "utf8"));',
      'const strictEd25519ManifestBytes = new Uint8Array(await readFile(strictEd25519ManifestUrl));',
      'const bootstrapTrustBundleBytes = new Uint8Array(await readFile(bootstrapTrustBundleUrl));',
      'const bootstrapTrustGolden = JSON.parse(await readFile(bootstrapTrustGoldenUrl, "utf8"));',
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
      'const bootstrapTrustGoldenValidation = await root.verifyProviderBootstrapTrustGoldenManifestV1(bootstrapTrustGolden, strictCapability);',
      'if (bootstrapTrustGoldenValidation.authority !== "none_structure_only" || bootstrapTrustGoldenValidation.manifest.vectors.recoveryKeyIds.length !== 3) throw new Error("packed bootstrap trust golden failed");',
      'const deterministicVector = bootstrapTrustGoldenValidation.manifest.vectors.deterministicRootSelfSignatureSigning;',
      'const deterministicPrivateKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(deterministicVector.rfc8032TestSeedHex, "hex")]), format: "der", type: "pkcs8" });',
      'const deterministicSpki = createPublicKey(deterministicPrivateKey).export({ format: "der", type: "spki" });',
      'if (deterministicSpki.subarray(-32).toString("hex") !== deterministicVector.expected.rawPublicKeyHex || sign(null, Buffer.from(deterministicVector.expected.canonicalMessageUtf8Hex, "hex"), deterministicPrivateKey).toString("hex") !== deterministicVector.expected.rawSignatureHex) throw new Error("packed deterministic signing golden failed");',
      'const bootstrapValidation = await root.validateProviderBootstrapTrustBundleStructureV1({ bundleEnvelopeBytes: bootstrapTrustBundleBytes, strictManifestEnvelopeBytes: strictEd25519ManifestBytes, strictCryptoCapability: strictCapability });',
      'if (bootstrapValidation.authority !== "none_structure_only" || bootstrapValidation.bundleEnvelope.contentDigest !== root.PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1) throw new Error("packed bootstrap trust validation failed");',
      'if (pointCalls !== 62 || verifyCalls !== 31) throw new Error(`packed bootstrap crypto calls: ${pointCalls}/${verifyCalls}`);',
      'try { await import("@understand-code/durable-object-provider-contracts/domain-crypto"); throw new Error("private crypto helper exported"); } catch (error) { if (error?.message === "private crypto helper exported") throw error; }',
    ].join("\n"),
    "utf8",
  );
  run(process.execPath, [runtimeProbe], { cwd: consumerRoot });

  const typeProbe = join(consumerRoot, "type-probe.mts");
  await writeFile(
    typeProbe,
    [
      'import { DurableObjectIdentityProviderIdV1Schema, DurableObjectIdentityProviderSlugV1Schema, createDurableObjectIdentityProviderIdV1 } from "@understand-code/durable-object-provider-contracts";',
      'import { createProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'import type { ProviderCapabilityFailureReasonV1, ProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'import type { Ed25519PublicKeyDigestV1, ContentDigestV1, ProviderBootstrapTrustBundleStructureValidationV1, ProviderBootstrapTrustGoldenManifestValidationV1, ProviderStrictEd25519FixedResourceHostV1 } from "@understand-code/durable-object-provider-contracts";',
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
      'void rawKeyDigest;',
      'void resourceHost;',
      'const structureAuthority: "none_structure_only" = bootstrapValidation.authority;',
      'const fixtureAuthority: "none_structure_only" = goldenValidation.authority;',
      'void structureAuthority;',
      'void fixtureAuthority;',
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
  const packedProviderFiles = await listFiles(
    join(installedRoot, "provider"),
  );
  const bundleAliases = [];
  const manifestAliases = [];
  const expectedBundleBytes = Buffer.from(
    packedBootstrapTrustBundleText,
    "utf8",
  );
  const expectedManifestBytes = Buffer.from(
    packedStrictEd25519ManifestText,
    "utf8",
  );
  for (const filePath of packedProviderFiles) {
    const relativePath = relative(installedRoot, filePath)
      .split(sep)
      .join("/");
    const fileBytes = await readFile(filePath);
    if (fileBytes.equals(expectedBundleBytes)) {
      bundleAliases.push(relativePath);
    }
    if (fileBytes.equals(expectedManifestBytes)) {
      manifestAliases.push(relativePath);
    }
  }
  assertExactResourceMatchPaths(
    bundleAliases.sort(),
    "provider/bootstrap-trust-bundle-v1.json",
    "bootstrap trust bundle",
  );
  assertExactResourceMatchPaths(
    manifestAliases.sort(),
    "provider/ed25519-strict-host-conformance-v1.json",
    "strict Ed25519 manifest",
  );
  await writeFile(
    join(consumerRoot, "browser-entry.js"),
    [
      'import { ProviderUnavailableToolErrorV1Schema, createProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'import { PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1, validateProviderBootstrapTrustBundleStructureV1, verifyProviderBootstrapTrustGoldenManifestV1 } from "@understand-code/durable-object-provider-contracts";',
      'import { STRICT_ED25519_VERIFICATION_PROFILE_V1, validatePrimeSubgroupPoint, verifyRawEd25519 } from "@understand-code/durable-object-provider-contracts/strict-ed25519";',
      'import { PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1, PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1, attestProviderStrictEd25519CryptoHostV1, getProviderStrictEd25519CryptoCapabilityBytesV1 } from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";',
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as providerContractBrowserModule${index} from ${JSON.stringify(specifier)};`,
      ),
      `const manifestResourceBytes = new TextEncoder().encode(${JSON.stringify(packedStrictEd25519ManifestText)});`,
      `const bundleResourceBytes = new TextEncoder().encode(${JSON.stringify(packedBootstrapTrustBundleText)});`,
      `const bootstrapTrustGolden = JSON.parse(${JSON.stringify(packedBootstrapTrustGoldenText)});`,
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
      'const bootstrapGoldenValidation = await verifyProviderBootstrapTrustGoldenManifestV1(bootstrapTrustGolden, strictCapability);',
      'if (bootstrapGoldenValidation.authority !== "none_structure_only" || bootstrapGoldenValidation.manifest.vectors.recoveryKeyIds.length !== 3) throw new Error("browser bootstrap golden mismatch");',
      'const capabilityBytes = getProviderStrictEd25519CryptoCapabilityBytesV1(strictCapability);',
      'const providerError = createProviderUnavailableToolErrorV1("revoked");',
      'ProviderUnavailableToolErrorV1Schema.parse(providerError);',
      `const publicModules = [${explicitSpecifiers
        .map((_, index) => `providerContractBrowserModule${index}`)
        .join(", ")}];`,
      'if (publicModules.some((module) => Object.keys(module).length === 0)) throw new Error("empty browser public export");',
      'export const browserKatResult = Object.freeze({ pointCalls, verifyCalls, capabilityByteLength: capabilityBytes.byteLength, bootstrapAuthority: bootstrapValidation.authority, goldenAuthority: bootstrapGoldenValidation.authority, goldenCaseCount: 5 + bootstrapGoldenValidation.manifest.vectors.recoveryKeyIds.length, publicModuleCount: publicModules.length, providerReason: providerError.details.reason });',
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
      'if (browserKatResult.capabilityByteLength === 0) throw new Error("browser KAT capability is empty");',
      'if (browserKatResult.bootstrapAuthority !== "none_structure_only") throw new Error("browser bootstrap trust exposed authority");',
      'if (browserKatResult.goldenAuthority !== "none_structure_only" || browserKatResult.goldenCaseCount !== 8) throw new Error("browser bootstrap golden exposed authority or lost cases");',
      `if (browserKatResult.publicModuleCount !== ${explicitSpecifiers.length}) throw new Error("browser public module count mismatch");`,
      'if (browserKatResult.providerReason !== "revoked") throw new Error("browser provider error probe failed");',
    ].join("\n"),
    "utf8",
  );
  run(process.execPath, [browserRuntimeProbe], { cwd: consumerRoot });

  for (const requiredPath of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/bootstrap-trust-bundle.js",
    "dist/bootstrap-trust-bundle.d.ts",
    "dist/bootstrap-trust-golden.js",
    "dist/bootstrap-trust-golden.d.ts",
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
    "schemas/v1/provider-registry-root-metadata.schema.json",
    "schemas/v1/provider-signed-distribution-root-binding.schema.json",
    "schemas/v1/installation-identity-bootstrap-trust-fields.schema.json",
    "schemas/v1/provider-unavailable-tool-error.schema.json",
    "fixtures/v1/golden/manifest.json",
    "fixtures/v1/golden/ed25519-public-key-digest-v1.json",
    "fixtures/v1/golden/bootstrap-trust-bundle-v1.json",
    "fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json",
    "fixtures/v1/invalid/manifest.json",
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
    `Verified packed provider contracts with ${explicitSpecifiers.length} public module exports and an executed 62-point/31-signature browser ESM trust check.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
