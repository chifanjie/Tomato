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
      'const schema = JSON.parse(await readFile(schemaUrl, "utf8"));',
      'const providerErrorSchema = JSON.parse(await readFile(providerErrorSchemaUrl, "utf8"));',
      'const golden = JSON.parse(await readFile(goldenUrl, "utf8"));',
      'const providerErrorFixture = JSON.parse(await readFile(providerErrorFixtureUrl, "utf8"));',
      'if (schema.$id !== "urn:understand-code:provider-contract:schema:v1:canonical-byte-string") throw new Error("packed schema missing");',
      'if (providerErrorSchema.$id !== "urn:understand-code:provider-contract:schema:v1:provider-unavailable-tool-error") throw new Error("packed provider error schema missing");',
      'if (golden.profile !== "rfc8785-jcs-safe-integer-v1") throw new Error("packed golden manifest missing");',
      'if (providerErrorFixture.cases.length !== 6) throw new Error("packed provider error fixture missing");',
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
      'const slug = DurableObjectIdentityProviderSlugV1Schema.parse("native-fs");',
      'const id = createDurableObjectIdentityProviderIdV1(slug);',
      'DurableObjectIdentityProviderIdV1Schema.parse(id);',
      'const reason: ProviderCapabilityFailureReasonV1 = "attestation_invalid";',
      'const providerError: ProviderUnavailableToolErrorV1 = createProviderUnavailableToolErrorV1(reason);',
      'void providerError;',
      '// @ts-expect-error a raw string has not passed the branded slug schema',
      'createDurableObjectIdentityProviderIdV1("native-fs");',
      '// @ts-expect-error provider failure reasons are closed',
      'createProviderUnavailableToolErrorV1("network_error");',
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

  await writeFile(
    join(consumerRoot, "index.html"),
    '<!doctype html><script type="module" src="/browser-entry.js"></script>\n',
    "utf8",
  );
  await writeFile(
    join(consumerRoot, "browser-entry.js"),
    [
      'import { ProviderUnavailableToolErrorV1Schema, createProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as providerContractBrowserModule${index} from ${JSON.stringify(specifier)};`,
      ),
      'const providerError = createProviderUnavailableToolErrorV1("revoked");',
      'ProviderUnavailableToolErrorV1Schema.parse(providerError);',
      `globalThis.providerContractDistributionProbe = [providerError, ${explicitSpecifiers
        .map((_, index) => `providerContractBrowserModule${index}`)
        .join(", ")}];`,
    ].join("\n"),
    "utf8",
  );
  run(
    viteCommand,
    ["build", "--outDir", "browser-dist", "--emptyOutDir"],
    { cwd: consumerRoot },
  );
  const browserJavaScriptFiles = (
    await listFiles(join(consumerRoot, "browser-dist"))
  ).filter((filePath) => filePath.endsWith(".js"));
  if (browserJavaScriptFiles.length === 0) {
    throw new Error("Vite did not emit a browser JavaScript bundle");
  }
  const forbiddenBrowserRuntime =
    /(?:node:|require\s*\(|\bprocess\s*(?:\.|\[)|\bBuffer\b)/u;
  for (const filePath of browserJavaScriptFiles) {
    const source = await readFile(filePath, "utf8");
    if (forbiddenBrowserRuntime.test(source)) {
      throw new Error(
        `Browser bundle ${basename(filePath)} contains a Node runtime dependency`,
      );
    }
  }

  for (const requiredPath of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/jcs.js",
    "dist/provider-error.js",
    "dist/provider-error.d.ts",
    "schemas/v1/canonical-byte-string.schema.json",
    "schemas/v1/provider-unavailable-tool-error.schema.json",
    "fixtures/v1/golden/manifest.json",
    "fixtures/v1/invalid/manifest.json",
    "fixtures/v1/reference/provider-unavailable-tool-errors.json",
    "fixtures/v1/invalid/provider-unavailable-tool-errors.json",
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
    `Verified packed provider contracts with ${explicitSpecifiers.length} public module exports and a browser bundle.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
