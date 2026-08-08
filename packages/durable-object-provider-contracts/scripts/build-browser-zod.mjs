import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import ts from "typescript";
import { build } from "vite";

const EXPECTED_ZOD_VERSION = "4.3.6";
const EXPECTED_BROWSER_ZOD_BYTE_LENGTH = 461_202;
const EXPECTED_BROWSER_ZOD_SHA256 =
  "838c855b17d7108c6a19f6cfcd7de50eff6c08553c062b3e493b61e7b50e54f6";
const BROWSER_ZOD_RELATIVE_PATH = "./dist/browser-zod.js";
const ZOD_RUNTIME_RELATIVE_PATH = "./dist/zod-runtime.js";
const BROWSER_ZOD_FILE_NAME = "browser-zod.js";
const BROWSER_ZOD_LICENSE_FILE_NAME = "browser-zod.LICENSE.txt";
const VIRTUAL_ENTRY_ID = "\0provider-contracts-browser-zod-entry";
const LOCKED_ZOD_ENTRY_ID = "provider-contracts:locked-zod-entry";
const DISABLED_COMPILER_MESSAGE =
  "Zod dynamic compilation is disabled in this browser-safe build";
const DISABLED_TRANSPARENT_PROXY_MESSAGE =
  "Zod transparent proxy is disabled in this browser-safe build";
const ZOD_INPUT_SHA256 = Object.freeze({
  "LICENSE": "3f1189b28e3866e0d979968d466b78f813f76827cfdca1fbb124cc0a5c8841f8",
  "index.js": "c733a1897d6b4b30dad6998597f6896b265b094a65534359ada34b08ecf8932c",
  "package.json": "1a316ad36e36c6c500bce6e9a6dcbec8efda1083f49a72185226b35573b543ba",
  "v4/classic/external.js":
    "179a03ace3d1d77895cc5b3c54a3fcbf2b7f8bad44d6f030092491c10e5d9097",
  "v4/core/doc.js":
    "e084bbcc536746a8942fd33b08afe4db345554b3a0383114f1dca95261c958d9",
  "v4/core/schemas.js":
    "8f25b8fe962d889812763c51e1a10b439996ef59c65b3ee7c46df911f82c4b59",
  "v4/core/util.js":
    "e41f9e774b96a9fe2b04c08f5aad32e6db2f6aa090671d2a375e7062b4f178aa",
});
const ALLOWS_EVAL_SOURCE = [
  "        const F = Function;",
  '        new F("");',
  "        return true;",
].join("\n");
const ALLOWS_EVAL_REPLACEMENT = "        return false;";
const PLAIN_OBJECT_PROTOTYPE_CHECK_SOURCE =
  "    if (isObject(prot) === false)\n        return false;";
const PLAIN_OBJECT_PROTOTYPE_CHECK_REPLACEMENT = [
  '    if (typeof prot !== "object" || prot === null || Array.isArray(prot))',
  "        return false;",
].join("\n");
const TRANSPARENT_PROXY_SOURCE = [
  "export function createTransparentProxy(getter) {",
  "    let target;",
  "    return new Proxy({}, {",
  "        get(_, prop, receiver) {",
  "            target ?? (target = getter());",
  "            return Reflect.get(target, prop, receiver);",
  "        },",
  "        set(_, prop, value, receiver) {",
  "            target ?? (target = getter());",
  "            return Reflect.set(target, prop, value, receiver);",
  "        },",
  "        has(_, prop) {",
  "            target ?? (target = getter());",
  "            return Reflect.has(target, prop);",
  "        },",
  "        deleteProperty(_, prop) {",
  "            target ?? (target = getter());",
  "            return Reflect.deleteProperty(target, prop);",
  "        },",
  "        ownKeys(_) {",
  "            target ?? (target = getter());",
  "            return Reflect.ownKeys(target);",
  "        },",
  "        getOwnPropertyDescriptor(_, prop) {",
  "            target ?? (target = getter());",
  "            return Reflect.getOwnPropertyDescriptor(target, prop);",
  "        },",
  "        defineProperty(_, prop, descriptor) {",
  "            target ?? (target = getter());",
  "            return Reflect.defineProperty(target, prop, descriptor);",
  "        },",
  "    });",
  "}",
].join("\n");
const TRANSPARENT_PROXY_REPLACEMENT = [
  "export function createTransparentProxy(_getter) {",
  `    throw new Error(${JSON.stringify(DISABLED_TRANSPARENT_PROXY_MESSAGE)});`,
  "}",
].join("\n");
const DOC_COMPILE_SOURCE = [
  "        const F = Function;",
  "        const args = this?.args;",
  "        const content = this?.content ?? [``];",
  "        const lines = [...content.map((x) => `  ${x}`)];",
  '        // console.log(lines.join("\\n"));',
  '        return new F(...args, lines.join("\\n"));',
].join("\n");
const DOC_COMPILE_REPLACEMENT = `        throw new Error(${JSON.stringify(
  DISABLED_COMPILER_MESSAGE,
)});`;
const ZOD_FUNCTION_INITIALIZER_SOURCE = [
  'export const $ZodFunction = /*@__PURE__*/ core.$constructor("$ZodFunction", (inst, def) => {',
  "    $ZodType.init(inst, def);",
].join("\n");
const ZOD_FUNCTION_INITIALIZER_REPLACEMENT = [
  ZOD_FUNCTION_INITIALIZER_SOURCE,
  "    const F = inst._zod.constr;",
].join("\n");
const ZOD_FUNCTION_CONSTRUCTOR_SOURCE = "        const F = inst.constructor;\n";
const BROWSER_ZOD_BANNER = [
  "/*!",
  ` * Zod ${EXPECTED_ZOD_VERSION} browser-safe vendored runtime (MIT).`,
  " * Copyright (c) 2025 Colin McDonnell.",
  " * Dynamic Function compilation is disabled; the existing jitless path is used.",
  ` * Full license: ${BROWSER_ZOD_LICENSE_FILE_NAME}`,
  " */",
].join("\n");

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");
const distRoot = join(packageRoot, "dist");
const outputPath = join(distRoot, BROWSER_ZOD_FILE_NAME);
const outputLicensePath = join(distRoot, BROWSER_ZOD_LICENSE_FILE_NAME);
const require = createRequire(import.meta.url);

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isPathInside(rootPath, candidatePath) {
  const relativePath = relative(rootPath, candidatePath);
  return (
    relativePath.length > 0 &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function replaceExactlyOnce(source, expected, replacement, label) {
  const first = source.indexOf(expected);
  if (first < 0 || source.indexOf(expected, first + expected.length) >= 0) {
    throw new Error(`${label} source did not contain exactly one locked target`);
  }
  const transformed = `${source.slice(0, first)}${replacement}${source.slice(
    first + expected.length,
  )}`;
  if (transformed.includes(expected)) {
    throw new Error(`${label} locked target survived its replacement`);
  }
  return transformed;
}

function assertNoDynamicFunctionAst(source, label) {
  const sourceFile = ts.createSourceFile(
    label,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    throw new Error(`${label} is not parseable JavaScript`);
  }
  let dynamicFunctionIdentifierCount = 0;
  function visit(node) {
    if (ts.isIdentifier(node) && node.text === "Function") {
      dynamicFunctionIdentifierCount += 1;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (dynamicFunctionIdentifierCount !== 0) {
    throw new Error(
      `${label} contains ${dynamicFunctionIdentifierCount} dynamic Function AST identifiers`,
    );
  }
}

async function readAndVerifyLockedZodFile(zodRoot, relativePath) {
  const candidatePath = realpathSync(join(zodRoot, relativePath));
  if (!isPathInside(zodRoot, candidatePath)) {
    throw new Error(`Locked Zod input escaped its package root: ${relativePath}`);
  }
  const bytes = await readFile(candidatePath);
  const expectedDigest = ZOD_INPUT_SHA256[relativePath];
  if (expectedDigest === undefined || sha256Hex(bytes) !== expectedDigest) {
    throw new Error(`Locked Zod input digest drifted: ${relativePath}`);
  }
  return Object.freeze({ path: candidatePath, bytes });
}

async function main() {
  const localPackage = JSON.parse(
    await readFile(join(packageRoot, "package.json"), "utf8"),
  );
  if (
    localPackage.dependencies?.zod !== EXPECTED_ZOD_VERSION ||
    localPackage.browser?.[ZOD_RUNTIME_RELATIVE_PATH] !==
      BROWSER_ZOD_RELATIVE_PATH ||
    Object.keys(localPackage.browser ?? {}).length !== 1
  ) {
    throw new Error(
      "Browser-safe Zod build requires exact dependency and browser mapping locks",
    );
  }

  const zodPackageJsonPath = realpathSync(require.resolve("zod/package.json"));
  const zodRoot = realpathSync(dirname(zodPackageJsonPath));
  const lockedInputs = new Map();
  for (const relativePath of Object.keys(ZOD_INPUT_SHA256)) {
    lockedInputs.set(
      relativePath,
      await readAndVerifyLockedZodFile(zodRoot, relativePath),
    );
  }
  const zodPackage = JSON.parse(
    lockedInputs.get("package.json").bytes.toString("utf8"),
  );
  if (
    zodPackage.name !== "zod" ||
    zodPackage.version !== EXPECTED_ZOD_VERSION ||
    zodPackage.license !== "MIT"
  ) {
    throw new Error("Locked Zod package identity drifted");
  }

  const zodEntryPath = lockedInputs.get("index.js").path;
  const zodUtilPath = lockedInputs.get("v4/core/util.js").path;
  const zodDocPath = lockedInputs.get("v4/core/doc.js").path;
  await mkdir(distRoot, { recursive: true });
  await Promise.all([
    rm(outputPath, { force: true }),
    rm(outputLicensePath, { force: true }),
  ]);
  const temporaryOutputRoot = await mkdtemp(
    join(distRoot, ".browser-zod-build-"),
  );
  let published = false;
  let dynamicFunctionReplacementCount = 0;
  let constructorReplacementCount = 0;
  let prototypeClosureReplacementCount = 0;
  let removedDangerousSurfaceCount = 0;
  try {
    await build({
      root: packageRoot,
      configFile: false,
      logLevel: "silent",
      plugins: [
        {
          name: "provider-contracts-locked-browser-zod",
          enforce: "pre",
          resolveId(id) {
            if (id === "virtual:provider-contracts-browser-zod") {
              return VIRTUAL_ENTRY_ID;
            }
            if (id === LOCKED_ZOD_ENTRY_ID) return zodEntryPath;
            return undefined;
          },
          load(id) {
            if (id === VIRTUAL_ENTRY_ID) {
              return `export * from ${JSON.stringify(LOCKED_ZOD_ENTRY_ID)};`;
            }
            return undefined;
          },
          transform(source, id) {
            const sourcePath = id.split("?", 1)[0];
            if (sourcePath === zodUtilPath) {
              if (sha256Hex(source) !== ZOD_INPUT_SHA256["v4/core/util.js"]) {
                throw new Error("Locked Zod util transform input drifted");
              }
              dynamicFunctionReplacementCount += 1;
              prototypeClosureReplacementCount += 1;
              removedDangerousSurfaceCount += 1;
              return {
                code: replaceExactlyOnce(
                  replaceExactlyOnce(
                    replaceExactlyOnce(
                      source,
                      ALLOWS_EVAL_SOURCE,
                      ALLOWS_EVAL_REPLACEMENT,
                      "Zod allowsEval",
                    ),
                    PLAIN_OBJECT_PROTOTYPE_CHECK_SOURCE,
                    PLAIN_OBJECT_PROTOTYPE_CHECK_REPLACEMENT,
                    "Zod plain-object prototype closure",
                  ),
                  TRANSPARENT_PROXY_SOURCE,
                  TRANSPARENT_PROXY_REPLACEMENT,
                  "Zod transparent proxy surface",
                ),
                map: null,
              };
            }
            if (sourcePath === zodDocPath) {
              if (sha256Hex(source) !== ZOD_INPUT_SHA256["v4/core/doc.js"]) {
                throw new Error("Locked Zod Doc transform input drifted");
              }
              dynamicFunctionReplacementCount += 1;
              return {
                code: replaceExactlyOnce(
                  source,
                  DOC_COMPILE_SOURCE,
                  DOC_COMPILE_REPLACEMENT,
                  "Zod Doc.compile",
                ),
                map: null,
              };
            }
            if (sourcePath === lockedInputs.get("v4/core/schemas.js").path) {
              if (sha256Hex(source) !== ZOD_INPUT_SHA256["v4/core/schemas.js"]) {
                throw new Error("Locked Zod schemas transform input drifted");
              }
              const constructorMatches =
                source.split(ZOD_FUNCTION_CONSTRUCTOR_SOURCE).length - 1;
              const initializerMatches =
                source.split(ZOD_FUNCTION_INITIALIZER_SOURCE).length - 1;
              if (constructorMatches !== 2 || initializerMatches !== 1) {
                throw new Error(
                  `Zod function schema source contained ${initializerMatches}/1 initializer and ${constructorMatches}/2 constructor targets`,
                );
              }
              constructorReplacementCount += constructorMatches;
              return {
                code: source
                  .replace(
                    ZOD_FUNCTION_INITIALIZER_SOURCE,
                    ZOD_FUNCTION_INITIALIZER_REPLACEMENT,
                  )
                  .replaceAll(ZOD_FUNCTION_CONSTRUCTOR_SOURCE, ""),
                map: null,
              };
            }
            return undefined;
          },
        },
      ],
      build: {
        outDir: temporaryOutputRoot,
        emptyOutDir: true,
        minify: false,
        rollupOptions: {
          input: "virtual:provider-contracts-browser-zod",
          preserveEntrySignatures: "strict",
          output: {
            banner: BROWSER_ZOD_BANNER,
            entryFileNames: BROWSER_ZOD_FILE_NAME,
            format: "es",
          },
        },
      },
    });
    if (
      dynamicFunctionReplacementCount !== 2 ||
      constructorReplacementCount !== 2 ||
      prototypeClosureReplacementCount !== 1 ||
      removedDangerousSurfaceCount !== 1
    ) {
      throw new Error(
        `Browser-safe Zod build performed ${dynamicFunctionReplacementCount}/2 dynamic Function, ${constructorReplacementCount}/2 constructor, ${prototypeClosureReplacementCount}/1 prototype-closure, and ${removedDangerousSurfaceCount}/1 dangerous-surface removals`,
      );
    }

    const temporaryOutputPath = join(
      temporaryOutputRoot,
      BROWSER_ZOD_FILE_NAME,
    );
    const temporaryLicensePath = join(
      temporaryOutputRoot,
      BROWSER_ZOD_LICENSE_FILE_NAME,
    );
    const outputBytes = await readFile(temporaryOutputPath);
    const outputSource = outputBytes.toString("utf8");
    if (
      outputBytes.byteLength !== EXPECTED_BROWSER_ZOD_BYTE_LENGTH ||
      sha256Hex(outputBytes) !== EXPECTED_BROWSER_ZOD_SHA256 ||
      !outputSource.startsWith(BROWSER_ZOD_BANNER) ||
      !outputSource.includes(DISABLED_COMPILER_MESSAGE) ||
      !outputSource.includes(DISABLED_TRANSPARENT_PROXY_MESSAGE)
    ) {
      throw new Error(
        `Browser-safe Zod artifact drifted from its locked bytes: ${outputBytes.byteLength}/${sha256Hex(outputBytes)}`,
      );
    }
    assertNoDynamicFunctionAst(outputSource, BROWSER_ZOD_FILE_NAME);
    const browserZod = await import(
      `${pathToFileURL(temporaryOutputPath).href}?sha256=${sha256Hex(outputSource)}`
    );
    if (
      typeof browserZod.z?.strictObject !== "function" ||
      typeof browserZod.ZodObject !== "function" ||
      typeof browserZod.ZodError !== "function" ||
      typeof browserZod.toJSONSchema !== "function"
    ) {
      throw new Error("Browser-safe Zod artifact lost its Classic export surface");
    }
    let transparentProxyError;
    try {
      browserZod.util.createTransparentProxy(() => ({ ready: true }));
    } catch (error) {
      transparentProxyError = error;
    }
    if (
      !(transparentProxyError instanceof Error) ||
      transparentProxyError.message !== DISABLED_TRANSPARENT_PROXY_MESSAGE
    ) {
      throw new Error(
        "Browser-safe Zod transparent proxy surface did not fail closed",
      );
    }
    const surfaceProbe = browserZod.z.strictObject({
      value: browserZod.z.string().min(1),
    });
    if (
      surfaceProbe.constructor.name !== "ZodObject" ||
      typeof surfaceProbe.parse !== "function" ||
      typeof surfaceProbe.safeParse !== "function" ||
      typeof surfaceProbe.extend !== "function" ||
      typeof surfaceProbe.optional !== "function" ||
      typeof surfaceProbe.refine !== "function" ||
      typeof surfaceProbe.superRefine !== "function" ||
      typeof surfaceProbe.toJSONSchema !== "function" ||
      surfaceProbe.safeParse({ value: "probe" }).success !== true
    ) {
      throw new Error("Browser-safe Zod artifact failed its Classic schema probe");
    }
    const functionProbe = browserZod.z.function({
      input: [browserZod.z.string()],
      output: browserZod.z.string(),
    });
    const functionDerivatives = [
      functionProbe.input([browserZod.z.number()]),
      functionProbe.output(browserZod.z.number()),
    ];
    Object.defineProperty(functionProbe, "constructor", {
      configurable: true,
      value: Function,
    });
    Object.defineProperty(functionProbe._zod, "constr", {
      configurable: true,
      value: Function,
      writable: true,
    });
    functionDerivatives.push(
      functionProbe.input([browserZod.z.boolean()]),
      functionProbe.output(browserZod.z.boolean()),
    );
    if (
      functionDerivatives.some(
        (schema) =>
          !(schema instanceof browserZod.ZodFunction) ||
          typeof schema.parse !== "function" ||
          typeof schema.input !== "function" ||
          typeof schema.output !== "function" ||
          typeof schema.implement !== "function",
      )
    ) {
      throw new Error(
        "Browser-safe Zod function derivation lost its captured Classic constructor",
      );
    }

    await writeFile(
      temporaryLicensePath,
      lockedInputs.get("LICENSE").bytes,
      { mode: 0o644 },
    );
    const temporaryFiles = (await readdir(temporaryOutputRoot)).sort();
    if (
      JSON.stringify(temporaryFiles) !==
      JSON.stringify(
        [BROWSER_ZOD_FILE_NAME, BROWSER_ZOD_LICENSE_FILE_NAME].sort(),
      )
    ) {
      throw new Error(
        `Browser-safe Zod build emitted unexpected files: ${temporaryFiles.join(", ")}`,
      );
    }
    await rename(temporaryLicensePath, outputLicensePath);
    await rename(temporaryOutputPath, outputPath);
    published = true;
  } finally {
    await rm(temporaryOutputRoot, { recursive: true, force: true });
    if (!published) {
      await Promise.all([
        rm(outputPath, { force: true }),
        rm(outputLicensePath, { force: true }),
      ]);
    }
  }
}

await main();
