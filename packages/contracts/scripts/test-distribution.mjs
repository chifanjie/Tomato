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
const workspacePackagesRoot = resolve(packageRoot, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const viteCommand =
  process.env.UNDERSTAND_CODE_VITE_BIN ??
  join(
    workspacePackagesRoot,
    "dashboard",
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
    ? "@understand-code/contracts"
    : `@understand-code/contracts${exportKey.slice(1)}`;
}

const temporaryRoot = await mkdtemp(
  join(tmpdir(), "understand-code-contracts-distribution-"),
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

  run(
    npmCommand,
    ["pack", ".", "--pack-destination", packRoot, "--silent"],
    { cwd: cleanPackageRoot },
  );
  const tarballs = (await readdir(packRoot))
    .filter((fileName) => fileName.endsWith(".tgz"))
    .sort();
  if (tarballs.length !== 1) {
    throw new Error(
      `Expected exactly one Contracts tarball, found: ${tarballs.join(", ")}`,
    );
  }
  const tarballPath = join(packRoot, tarballs[0]);

  run(
    npmCommand,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      tarballPath,
    ],
    { cwd: consumerRoot },
  );

  const installedPackageRoot = join(
    consumerRoot,
    "node_modules",
    "@understand-code",
    "contracts",
  );
  const installedManifest = JSON.parse(
    await readFile(join(installedPackageRoot, "package.json"), "utf8"),
  );
  const explicitSpecifiers = Object.keys(installedManifest.exports)
    .filter((exportKey) => !exportKey.includes("*"))
    .map(packageSpecifier);

  const runtimeProbePath = join(consumerRoot, "runtime-probe.mjs");
  await writeFile(
    runtimeProbePath,
    [
      'import { readFile } from "node:fs/promises";',
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as contractModule${index} from ${JSON.stringify(specifier)};`,
      ),
      `const modules = [${explicitSpecifiers.map((_, index) => `contractModule${index}`).join(", ")}];`,
      "if (modules.some((contractModule) => Object.keys(contractModule).length === 0)) {",
      '  throw new Error("A declared Contracts export resolved to an empty module.");',
      "}",
      'const schemaUrl = new URL(import.meta.resolve("@understand-code/contracts/schemas/v1/task-manifest.schema.json"));',
      'const fixtureUrl = new URL(import.meta.resolve("@understand-code/contracts/fixtures/v1/reference/task.json"));',
      'const schema = JSON.parse(await readFile(schemaUrl, "utf8"));',
      'const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));',
      'if (schema.$id !== "urn:understand-code:schema:v1:task-manifest") {',
      '  throw new Error("The packed Task Manifest JSON Schema is missing or stale.");',
      "}",
      'if (fixture.artifactType !== "task_manifest") {',
      '  throw new Error("The packed reference Task fixture is missing or stale.");',
      "}",
    ].join("\n"),
    "utf8",
  );
  run(process.execPath, [runtimeProbePath], { cwd: consumerRoot });

  for (const requiredPath of [
    "dist/index.js",
    "dist/index.d.ts",
    "schemas/v1/task-manifest.schema.json",
    "fixtures/v1/reference/task.json",
    "README.md",
  ]) {
    if (!(await isFile(join(installedPackageRoot, requiredPath)))) {
      throw new Error(`Packed Contracts artifact is missing ${requiredPath}`);
    }
  }
  for (const forbiddenPath of ["src", "scripts", "test", "node_modules"]) {
    try {
      await stat(join(installedPackageRoot, forbiddenPath));
      throw new Error(
        `Packed Contracts artifact unexpectedly contains ${forbiddenPath}`,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("unexpectedly contains")
      ) {
        throw error;
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
      `void [${explicitSpecifiers.map((_, index) => `contractTypes${index}`).join(", ")}];`,
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
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as contractBrowserModule${index} from ${JSON.stringify(specifier)};`,
      ),
      `globalThis.contractDistributionProbe = [${explicitSpecifiers
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
    `Verified ${explicitSpecifiers.length} packed Contracts entry points, static assets, declarations, and browser portability.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
