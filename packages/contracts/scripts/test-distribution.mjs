import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");
const workspacePackagesRoot = resolve(packageRoot, "..");
const sourceWorkspaceRoot = resolve(workspacePackagesRoot, "..");
const providerPackageRoot = join(
  workspacePackagesRoot,
  "durable-object-provider-contracts",
);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
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
    const renderedCommand = [command, ...args].join(" ");
    throw new Error(
      [
        `Distribution smoke command failed (${result.status ?? "spawn error"}):`,
        renderedCommand,
        result.stdout?.trim(),
        result.stderr?.trim(),
        result.error?.stack,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
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

async function copyCleanWorkspacePackage(sourceRoot, targetRoot) {
  await mkdir(dirname(targetRoot), { recursive: true });
  await cp(sourceRoot, targetRoot, {
    recursive: true,
    filter(sourcePath) {
      const sourceRelativePath = relative(sourceRoot, sourcePath);
      if (sourceRelativePath === "") return true;
      const topLevelSegment = sourceRelativePath.split(sep)[0];
      return topLevelSegment !== "dist" && topLevelSegment !== "node_modules";
    },
  });
}

function packageSpecifier(exportKey) {
  return exportKey === "."
    ? "@understand-code/contracts"
    : `@understand-code/contracts${exportKey.slice(1)}`;
}

const sourceContractsManifest = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const sourceProviderManifest = JSON.parse(
  await readFile(join(providerPackageRoot, "package.json"), "utf8"),
);
if (
  sourceContractsManifest.dependencies?.[
    "@understand-code/durable-object-provider-contracts"
  ] !== "workspace:*"
) {
  throw new Error(
    "Source Contracts must declare the Provider runtime dependency as workspace:*.",
  );
}

const temporaryRoot = await mkdtemp(
  join(tmpdir(), "understand-code-contracts-distribution-"),
);

try {
  const syntheticWorkspaceRoot = join(temporaryRoot, "workspace");
  const cleanContractsRoot = join(
    syntheticWorkspaceRoot,
    "packages",
    "contracts",
  );
  const cleanProviderRoot = join(
    syntheticWorkspaceRoot,
    "packages",
    "durable-object-provider-contracts",
  );
  const packRoot = join(temporaryRoot, "pack");
  const consumerRoot = join(temporaryRoot, "consumer");
  await mkdir(packRoot, { recursive: true });
  await mkdir(consumerRoot, { recursive: true });
  await mkdir(syntheticWorkspaceRoot, { recursive: true });
  await writeFile(
    join(syntheticWorkspaceRoot, "pnpm-workspace.yaml"),
    'packages:\n  - "packages/*"\n',
    "utf8",
  );
  await cp(
    join(sourceWorkspaceRoot, "pnpm-lock.yaml"),
    join(syntheticWorkspaceRoot, "pnpm-lock.yaml"),
  );

  await copyCleanWorkspacePackage(providerPackageRoot, cleanProviderRoot);
  await copyCleanWorkspacePackage(packageRoot, cleanContractsRoot);
  run(
    pnpmCommand,
    ["install", "--frozen-lockfile", "--ignore-scripts"],
    { cwd: syntheticWorkspaceRoot },
  );
  const linkedProviderRoot = await realpath(
    join(
      cleanContractsRoot,
      "node_modules",
      "@understand-code",
      "durable-object-provider-contracts",
    ),
  );
  const isolatedProviderRoot = await realpath(cleanProviderRoot);
  if (linkedProviderRoot !== isolatedProviderRoot) {
    throw new Error(
      `Synthetic Contracts resolved Provider outside its clean workspace: ${linkedProviderRoot}`,
    );
  }

  run(
    pnpmCommand,
    ["run", "build"],
    { cwd: cleanProviderRoot },
  );
  run(
    npmCommand,
    [
      "pack",
      ".",
      "--ignore-scripts",
      "--pack-destination",
      packRoot,
      "--silent",
    ],
    { cwd: cleanProviderRoot },
  );
  run(
    pnpmCommand,
    ["pack", "--pack-destination", packRoot],
    { cwd: cleanContractsRoot },
  );

  const tarballs = (await readdir(packRoot))
    .filter((fileName) => fileName.endsWith(".tgz"))
    .sort();
  const providerTarballs = tarballs.filter((fileName) =>
    fileName.includes("durable-object-provider-contracts"),
  );
  const contractsTarballs = tarballs.filter(
    (fileName) => !fileName.includes("durable-object-provider-contracts"),
  );
  if (providerTarballs.length !== 1 || contractsTarballs.length !== 1) {
    throw new Error(
      `Expected one Provider and one Contracts tarball, found: ${tarballs.join(", ")}`,
    );
  }
  const providerTarballPath = join(packRoot, providerTarballs[0]);
  const contractsTarballPath = join(packRoot, contractsTarballs[0]);

  run(
    npmCommand,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      providerTarballPath,
      contractsTarballPath,
    ],
    { cwd: consumerRoot },
  );
  const installedTree = JSON.parse(
    run(
      npmCommand,
      [
        "ls",
        "@understand-code/contracts",
        "@understand-code/durable-object-provider-contracts",
        "--all",
        "--json",
      ],
      { cwd: consumerRoot },
    ),
  );
  if (
    Array.isArray(installedTree.problems) &&
    installedTree.problems.length !== 0
  ) {
    throw new Error(
      `Cold installed dependency tree is invalid: ${installedTree.problems.join(", ")}`,
    );
  }

  const installedContractsRoot = join(
    consumerRoot,
    "node_modules",
    "@understand-code",
    "contracts",
  );
  const installedProviderRoot = join(
    consumerRoot,
    "node_modules",
    "@understand-code",
    "durable-object-provider-contracts",
  );
  const packedContractsManifest = JSON.parse(
    await readFile(join(installedContractsRoot, "package.json"), "utf8"),
  );
  const packedProviderManifest = JSON.parse(
    await readFile(join(installedProviderRoot, "package.json"), "utf8"),
  );
  const packedProviderDependency =
    packedContractsManifest.dependencies?.[
      "@understand-code/durable-object-provider-contracts"
    ];
  if (
    packedProviderDependency !== packedProviderManifest.version ||
    packedProviderDependency !== sourceProviderManifest.version ||
    typeof packedProviderDependency !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(packedProviderDependency) ||
    /^(?:workspace|link|file):/u.test(packedProviderDependency)
  ) {
    throw new Error(
      `Packed Contracts Provider dependency must be exact ${sourceProviderManifest.version}; found ${String(packedProviderDependency)}`,
    );
  }
  const providerErrorExport = packedProviderManifest.exports?.["./provider-error"];
  if (
    providerErrorExport?.types !== "./dist/provider-error.d.ts" ||
    providerErrorExport?.import !== "./dist/provider-error.js" ||
    providerErrorExport?.default !== "./dist/provider-error.js"
  ) {
    throw new Error(
      "Packed Provider must expose provider-error import/default/types conditions.",
    );
  }
  const nestedProviderRoot = join(
    installedContractsRoot,
    "node_modules",
    "@understand-code",
    "durable-object-provider-contracts",
  );
  if (await exists(nestedProviderRoot)) {
    throw new Error(
      "Cold install nested the Provider below Contracts instead of resolving the explicit Provider tarball.",
    );
  }

  const explicitSpecifiers = Object.keys(packedContractsManifest.exports)
    .filter((exportKey) => !exportKey.includes("*"))
    .map(packageSpecifier);

  const runtimeProbePath = join(consumerRoot, "runtime-probe.mjs");
  await writeFile(
    runtimeProbePath,
    [
      'import { readFile } from "node:fs/promises";',
      'import * as contractsRoot from "@understand-code/contracts";',
      'import * as contractsMcp from "@understand-code/contracts/mcp";',
      'import { verifyStep16DualHostEligibleEvidenceV1 as directGoldVerifier } from "@understand-code/contracts/alpha-gold-verifier";',
      'import * as providerRoot from "@understand-code/durable-object-provider-contracts";',
      'import * as providerError from "@understand-code/durable-object-provider-contracts/provider-error";',
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as contractModule${index} from ${JSON.stringify(specifier)};`,
      ),
      `const modules = [${explicitSpecifiers.map((_, index) => `contractModule${index}`).join(", ")}];`,
      "if (modules.some((contractModule) => Object.keys(contractModule).length === 0)) {",
      '  throw new Error("A declared Contracts export resolved to an empty module.");',
      "}",
      'if (contractsRoot.verifyStep16DualHostEligibleEvidenceV1 !== directGoldVerifier) throw new Error("Gold verifier identity split across package entry points.");',
      'if (await directGoldVerifier({}, "not-base64")) throw new Error("Packed Gold verifier did not fail closed.");',
      "const authoritativeSchema = providerError.ProviderUnavailableToolErrorV1Schema;",
      "for (const schema of [providerRoot.ProviderUnavailableToolErrorV1Schema, contractsRoot.ProviderUnavailableToolErrorV1Schema, contractsMcp.ProviderUnavailableToolErrorV1Schema]) {",
      '  if (schema !== authoritativeSchema) throw new Error("Provider error Schema identity split across packages/entry points.");',
      "}",
      "for (const reason of providerError.PROVIDER_CAPABILITY_FAILURE_REASONS_V1) {",
      "  const error = providerError.createProviderUnavailableToolErrorV1(reason);",
      '  if (!contractsMcp.ToolErrorEnvelopeV1Schema.safeParse(error).success) throw new Error(`Contracts rejected provider reason ${reason}.`);',
      "  if (contractsMcp.ToolErrorEnvelopeV1Schema.safeParse({ ...error, retryable: true }).success) throw new Error(\"Contracts accepted provider retry metadata.\");",
      "  if (contractsMcp.ToolErrorEnvelopeV1Schema.safeParse({ ...error, details: { ...error.details, locator: \"private\" } }).success) throw new Error(\"Contracts accepted provider private details.\");",
      "}",
      'const schemaUrl = new URL(import.meta.resolve("@understand-code/contracts/schemas/v1/task-manifest.schema.json"));',
      'const toolErrorSchemaUrl = new URL(import.meta.resolve("@understand-code/contracts/schemas/v1/tool-error-envelope.schema.json"));',
      'const fixtureUrl = new URL(import.meta.resolve("@understand-code/contracts/fixtures/v1/reference/task.json"));',
      'const providerSchemaUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/schemas/v1/provider-unavailable-tool-error.schema.json"));',
      'const providerFixtureUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/reference/provider-unavailable-tool-errors.json"));',
      'const schema = JSON.parse(await readFile(schemaUrl, "utf8"));',
      'const toolErrorSchema = JSON.parse(await readFile(toolErrorSchemaUrl, "utf8"));',
      'const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));',
      'const providerSchema = JSON.parse(await readFile(providerSchemaUrl, "utf8"));',
      'const providerFixture = JSON.parse(await readFile(providerFixtureUrl, "utf8"));',
      'if (schema.$id !== "urn:understand-code:schema:v1:task-manifest") throw new Error("Packed Task Manifest JSON Schema is missing or stale.");',
      'if (!JSON.stringify(toolErrorSchema).includes("provider_unavailable")) throw new Error("Packed Contracts Tool Error JSON Schema omits the Provider branch.");',
      'if (fixture.artifactType !== "task_manifest") throw new Error("Packed reference Task fixture is missing or stale.");',
      'if (providerSchema.$id !== "urn:understand-code:provider-contract:schema:v1:provider-unavailable-tool-error") throw new Error("Packed Provider error JSON Schema is missing or stale.");',
      'if (providerFixture.cases.length !== 6) throw new Error("Packed Provider error reference fixture is missing or stale.");',
    ].join("\n"),
    "utf8",
  );
  run(process.execPath, [runtimeProbePath], { cwd: consumerRoot });

  for (const requiredPath of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/mcp.js",
    "dist/mcp.d.ts",
    "dist/alpha-gold-verifier.js",
    "dist/alpha-gold-verifier.d.ts",
    "schemas/v1/task-manifest.schema.json",
    "schemas/v1/tool-error-envelope.schema.json",
    "schemas/v1/mcp-tool-error-result.schema.json",
    "fixtures/v1/reference/task.json",
    "README.md",
  ]) {
    if (!(await isFile(join(installedContractsRoot, requiredPath)))) {
      throw new Error(`Packed Contracts artifact is missing ${requiredPath}`);
    }
  }
  for (const requiredPath of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/provider-error.js",
    "dist/provider-error.d.ts",
    "schemas/v1/provider-unavailable-tool-error.schema.json",
    "fixtures/v1/reference/provider-unavailable-tool-errors.json",
    "fixtures/v1/invalid/provider-unavailable-tool-errors.json",
    "README.md",
  ]) {
    if (!(await isFile(join(installedProviderRoot, requiredPath)))) {
      throw new Error(`Packed Provider artifact is missing ${requiredPath}`);
    }
  }
  for (const [label, installedRoot] of [
    ["Contracts", installedContractsRoot],
    ["Provider", installedProviderRoot],
  ]) {
    for (const forbiddenPath of ["src", "scripts", "test"]) {
      if (await exists(join(installedRoot, forbiddenPath))) {
        throw new Error(
          `Packed ${label} artifact unexpectedly contains ${forbiddenPath}`,
        );
      }
    }
  }

  const typeProbePath = join(consumerRoot, "type-probe.mts");
  await writeFile(
    typeProbePath,
    [
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as contractTypes${index} from ${JSON.stringify(specifier)};`,
      ),
      'import { ProviderUnavailableToolErrorV1Schema as ContractsRootProviderErrorSchema } from "@understand-code/contracts";',
      'import { verifyStep16DualHostEligibleEvidenceV1 } from "@understand-code/contracts/alpha-gold-verifier";',
      'import type { AssembleStep16DualHostEligibleEvidenceV1Input, Step16GoldEd25519SignerV1 } from "@understand-code/contracts/alpha-gold-verifier";',
      'import type { ProviderUnavailableToolErrorV1 as ContractsRootProviderError } from "@understand-code/contracts";',
      'import { ProviderUnavailableToolErrorV1Schema as ContractsProviderErrorSchema } from "@understand-code/contracts/mcp";',
      'import type { ProviderUnavailableToolErrorV1 as ContractsProviderError, ToolErrorEnvelopeV1 } from "@understand-code/contracts/mcp";',
      'import { ProviderUnavailableToolErrorV1Schema as ProviderRootErrorSchema } from "@understand-code/durable-object-provider-contracts";',
      'import type { ProviderUnavailableToolErrorV1 as ProviderRootError } from "@understand-code/durable-object-provider-contracts";',
      'import { ProviderUnavailableToolErrorV1Schema as DirectProviderErrorSchema, createProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'import type { ProviderCapabilityFailureReasonV1, ProviderUnavailableToolErrorV1 as DirectProviderError } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'type ProviderErrorBranch = Extract<ToolErrorEnvelopeV1, { code: "provider_unavailable" }>;',
      "type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends (<Value>() => Value extends Right ? 1 : 2) ? (<Value>() => Value extends Right ? 1 : 2) extends (<Value>() => Value extends Left ? 1 : 2) ? true : false : false;",
      "type Assert<Value extends true> = Value;",
      "type ContractsReExportIsExact = Assert<Equal<ContractsProviderError, DirectProviderError>>;",
      "type ContractsRootReExportIsExact = Assert<Equal<ContractsRootProviderError, DirectProviderError>>;",
      "type ProviderRootReExportIsExact = Assert<Equal<ProviderRootError, DirectProviderError>>;",
      "type UnionBranchIsExact = Assert<Equal<ProviderErrorBranch, DirectProviderError>>;",
      "declare const directError: DirectProviderError;",
      "declare const unionError: ProviderErrorBranch;",
      "const directToUnion: ProviderErrorBranch = directError;",
      "const unionToDirect: DirectProviderError = unionError;",
      'const reason: ProviderCapabilityFailureReasonV1 = "attestation_invalid";',
      "const created: ContractsProviderError = createProviderUnavailableToolErrorV1(reason);",
      'const failClosedVerification: Promise<boolean> = verifyStep16DualHostEligibleEvidenceV1({}, "not-base64");',
      "declare const signer: Step16GoldEd25519SignerV1;",
      "declare const assemblerInput: AssembleStep16DualHostEligibleEvidenceV1Input;",
      "ContractsProviderErrorSchema.parse(created);",
      "ContractsRootProviderErrorSchema.parse(created);",
      "DirectProviderErrorSchema.parse(created);",
      "ProviderRootErrorSchema.parse(created);",
      "void [",
      ...explicitSpecifiers.map((_, index) => `  contractTypes${index},`),
      "  directToUnion,",
      "  unionToDirect,",
      "  created,",
      "  failClosedVerification,",
      "  signer,",
      "  assemblerInput,",
      "  null as unknown as ContractsReExportIsExact,",
      "  null as unknown as ContractsRootReExportIsExact,",
      "  null as unknown as ProviderRootReExportIsExact,",
      "  null as unknown as UnionBranchIsExact,",
      "];",
      "// @ts-expect-error provider failure reasons are a closed allowlist",
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
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      typeProbePath,
    ],
    { cwd: consumerRoot },
  );

  const browserEntryPath = join(consumerRoot, "browser-entry.js");
  await writeFile(
    join(consumerRoot, "index.html"),
    '<!doctype html><script type="module" src="/browser-entry.js"></script>\n',
    "utf8",
  );
  await writeFile(
    browserEntryPath,
    [
      'import { ProviderUnavailableToolErrorV1Schema as ContractsProviderErrorSchema, ToolErrorEnvelopeV1Schema } from "@understand-code/contracts/mcp";',
      'import { verifyStep16DualHostEligibleEvidenceV1 as rootGoldVerifier } from "@understand-code/contracts";',
      'import { verifyStep16DualHostEligibleEvidenceV1 as directGoldVerifier } from "@understand-code/contracts/alpha-gold-verifier";',
      'import { PROVIDER_CAPABILITY_FAILURE_REASONS_V1, ProviderUnavailableToolErrorV1Schema as DirectProviderErrorSchema, createProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as contractBrowserModule${index} from ${JSON.stringify(specifier)};`,
      ),
      'if (ContractsProviderErrorSchema !== DirectProviderErrorSchema) throw new Error("browser schema identity split");',
      'if (rootGoldVerifier !== directGoldVerifier) throw new Error("browser Gold verifier identity split");',
      "const providerErrors = PROVIDER_CAPABILITY_FAILURE_REASONS_V1.map((reason) => createProviderUnavailableToolErrorV1(reason));",
      'if (providerErrors.some((error) => !ToolErrorEnvelopeV1Schema.safeParse(error).success)) throw new Error("browser provider error parse failed");',
      `globalThis.contractDistributionProbe = [providerErrors, directGoldVerifier, ${explicitSpecifiers
        .map((_, index) => `contractBrowserModule${index}`)
        .join(", ")}];`,
    ].join("\n"),
    "utf8",
  );
  run(
    viteCommand,
    ["build", "--outDir", "browser-dist", "--emptyOutDir"],
    { cwd: consumerRoot },
  );
  const browserOutputRoot = join(consumerRoot, "browser-dist");
  const browserJavaScriptFiles = (await listFiles(browserOutputRoot)).filter(
    (filePath) => filePath.endsWith(".js"),
  );
  if (browserJavaScriptFiles.length === 0) {
    throw new Error("Vite did not emit a browser JavaScript bundle.");
  }
  const forbiddenBrowserRuntime =
    /(?:node:|require\s*\(|\bprocess\s*(?:\.|\[)|\bBuffer\b)/u;
  for (const filePath of browserJavaScriptFiles) {
    const bundledSource = await readFile(filePath, "utf8");
    if (forbiddenBrowserRuntime.test(bundledSource)) {
      throw new Error(
        `Browser bundle ${basename(filePath)} contains a Node runtime dependency.`,
      );
    }
  }

  process.stdout.write(
    `Verified ${explicitSpecifiers.length} packed Contracts entry points with an exact packed Provider dependency, shared Schema identity, declarations, fixtures, and browser portability.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
