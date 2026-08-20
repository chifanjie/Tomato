import { chmod, mkdir, readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { copyCurrentNativeKernelPeerAssetV1 } from "./native-kernel-peer-asset.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(packageRoot, "../..");

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
  };
  for (let index = 0; index < values.length; index += 1) {
    const flag = values[index];
    const value = values[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag ?? "bundle option"}`);
    }
    if (flag === "--output") result.output = path.resolve(value);
    else if (
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

await mkdir(path.dirname(output), { recursive: true });
const result = await build({
  entryPoints: [bundleProfile.entryPoint],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  treeShaking: true,
  legalComments: "none",
  sourcemap: false,
  metafile: true,
  define: {
    __UNDERSTAND_CODE_MCP_TOOL_SURFACE_PROFILE__: JSON.stringify(
      bundleProfile.toolSurfaceProfile,
    ),
  },
  banner: {
    js: [
      "#!/usr/bin/env node",
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
      "packages/durable-object-provider-runtime/dist/native",
    ),
    destinationNativeRoot: path.join(path.dirname(output), "native"),
  });
}
