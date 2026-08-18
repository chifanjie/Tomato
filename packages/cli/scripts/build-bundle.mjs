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
const output = path.join(packageRoot, "dist/understand-code.mjs");

await mkdir(path.dirname(output), { recursive: true });
const result = await build({
  entryPoints: [path.join(packageRoot, "src/bin.ts")],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  treeShaking: true,
  legalComments: "none",
  sourcemap: false,
  metafile: true,
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
await copyCurrentNativeKernelPeerAssetV1({
  sourceNativeRoot: path.join(
    workspaceRoot,
    "packages/durable-object-provider-runtime/dist/native",
  ),
  destinationNativeRoot: path.join(packageRoot, "dist/native"),
});
