import { chmod, mkdir, readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { copyCurrentNativeKernelPeerAssetV1 } from "./native-kernel-peer-asset.mjs";
import { encodeRepositoryParserAssetsV1 } from "./parser-assets.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(packageRoot, "../..");
const packageMetadata = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8"),
);
const SEMVER_PATTERN =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

function validProductVersion(value) {
  return (
    typeof value === "string" &&
    Buffer.byteLength(value, "utf8") <= 128 &&
    SEMVER_PATTERN.test(value)
  );
}

if (!validProductVersion(packageMetadata.version)) {
  throw new Error("CLI package version is not a valid product version.");
}

const bundleProfiles = Object.freeze({
  full: Object.freeze({
    entryPoint: path.join(packageRoot, "src/bin.ts"),
    toolSurfaceProfile: "full",
    copyNativeKernelPeer: true,
  }),
  preview_three_tool_v1: Object.freeze({
    entryPoint: path.join(packageRoot, "src/preview-bin.ts"),
    toolSurfaceProfile: "preview_three_tool_v1",
    copyNativeKernelPeer: false,
  }),
});

function parseArguments(values) {
  const result = {
    output: path.join(packageRoot, "dist/understand-code.mjs"),
    bundleProfile: "full",
    productVersion: packageMetadata.version,
  };
  for (let index = 0; index < values.length; index += 1) {
    const flag = values[index];
    const value = values[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag ?? "bundle option"}`);
    }
    if (flag === "--output") result.output = path.resolve(value);
    else if (flag === "--product-version" && validProductVersion(value)) {
      result.productVersion = value;
    } else if (
      flag === "--bundle-profile" &&
      Object.hasOwn(bundleProfiles, value)
    ) {
      result.bundleProfile = value;
    } else {
      throw new Error(`Unknown or invalid bundle option: ${flag ?? ""}`);
    }
    index += 1;
  }
  return result;
}

const bundleOptions = parseArguments(process.argv.slice(2));
const output = bundleOptions.output;
const bundleProfile = bundleProfiles[bundleOptions.bundleProfile];
if (bundleProfile === undefined) throw new Error("Unknown bundle profile.");
const { notices: parserNotices, ...parserAssets } = bundleOptions.bundleProfile === "full"
  ? await encodeRepositoryParserAssetsV1()
  : { notices: "" };

await mkdir(path.dirname(output), { recursive: true });
const result = await build({
  entryPoints: [bundleProfile.entryPoint],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  minify: true,
  treeShaking: true,
  legalComments: "none",
  sourcemap: false,
  metafile: true,
  define: {
    __UNDERSTAND_CODE_BUNDLED_WRITER__: "true",
    __UNDERSTAND_CODE_WRITER_GUIDES__: JSON.stringify({
      files: await readFile(path.join(workspaceRoot, "agents/kb-file-writer.md"), "utf8"),
      topics: await readFile(path.join(workspaceRoot, "agents/kb-topic-writer.md"), "utf8"),
      featured: await readFile(path.join(workspaceRoot, "agents/kb-featured-writer.md"), "utf8"),
    }),
    __UNDERSTAND_CODE_PRODUCT_VERSION__: JSON.stringify(
      bundleOptions.productVersion,
    ),
    __UNDERSTAND_CODE_MCP_TOOL_SURFACE_PROFILE__: JSON.stringify(
      bundleProfile.toolSurfaceProfile,
    ),
    __UNDERSTAND_CODE_PARSER_ASSETS_V1__: bundleOptions.bundleProfile === "full"
      ? JSON.stringify(parserAssets)
      : "undefined",
  },
  banner: {
    js: [
      "#!/usr/bin/env node",
      `/* understand-code-release-v1 product=understand-code version=${bundleOptions.productVersion} */`,
      ...(parserNotices === "" ? [] : [`/* Fixed parser third-party notices\n${parserNotices.replaceAll("*/", "* /")}\n*/`]),
      'import { createRequire as __understandCreateRequire } from "node:module";',
      "const require = __understandCreateRequire(import.meta.url);",
    ].join("\n"),
  },
});

const externalImports = Object.values(result.metafile.outputs)
  .flatMap((entry) => entry.imports)
  .filter(
    (entry) =>
      entry.external &&
      !entry.path.startsWith("node:") &&
      !builtinModules.includes(entry.path),
  );
if (externalImports.length > 0) {
  throw new Error("The CLI bundle contains non-Node external imports.");
}

const bytes = await readFile(output, "utf8");
if (/workspace:\*/u.test(bytes)) {
  throw new Error("The CLI bundle contains an unresolved workspace dependency.");
}
await chmod(output, 0o755);
if (bundleProfile.copyNativeKernelPeer) {
  await copyCurrentNativeKernelPeerAssetV1({
    sourceNativeRoot: path.join(
      workspaceRoot,
      "packages/native-kernel-bridge/dist/native",
    ),
    destinationNativeRoot: path.join(path.dirname(output), "native"),
  });
}
