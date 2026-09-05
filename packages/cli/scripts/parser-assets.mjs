import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

import { builtinLanguageConfigs } from "../../core/dist/languages/index.js";

const coreRequire = createRequire(new URL("../../core/package.json", import.meta.url));
const RUNTIME = "web-tree-sitter/web-tree-sitter.wasm";

// The fixed parser bytes travel inside the CLI whose digest is already bound
// by installation and release manifests. No additional runtime lookup or
// mutable grammar directory is needed by a cold installed Host.
export async function encodeRepositoryParserAssetsV1() {
  const languages = Object.fromEntries(builtinLanguageConfigs
    .filter((config) => config.treeSitter !== undefined)
    .map((config) => [config.id, `${config.treeSitter.wasmPackage}/${config.treeSitter.wasmFile}`]));
  languages.tsx = "tree-sitter-typescript/tree-sitter-tsx.wasm";
  const assets = {};
  const contents = [];
  const notices = new Map();
  let totalBytes = 0;
  for (const specifier of [...new Set([RUNTIME, ...Object.values(languages)])].sort()) {
    const source = coreRequire.resolve(specifier);
    const bytes = await readFile(source);
    const packageRoot = path.dirname(source);
    const metadata = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
    if (metadata.name !== specifier.split("/")[0] || typeof metadata.version !== "string") {
      throw new Error(`Fixed parser package identity mismatch: ${specifier}`);
    }
    if (!notices.has(metadata.name)) {
      const license = await readFile(path.join(packageRoot, "LICENSE"), "utf8");
      notices.set(metadata.name, `${metadata.name}@${metadata.version}\n${license.trim()}`);
    }
    if (bytes.length < 8 || bytes.length > 8 * 1024 * 1024 ||
      !bytes.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]))) {
      throw new Error(`Invalid fixed parser WASM: ${specifier}`);
    }
    assets[specifier] = {
      offset: totalBytes,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    totalBytes += bytes.length;
    if (totalBytes > 24 * 1024 * 1024) throw new Error("Fixed parser assets exceed the bounded inventory");
    contents.push(bytes);
  }
  const data = brotliCompressSync(Buffer.concat(contents), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).toString("base64");
  return { schemaVersion: 1, runtime: RUNTIME, languages, assets, data,
    notices: [...notices.entries()].sort(([left], [right]) => left.localeCompare(right))
      .map(([, notice]) => notice).join("\n\n") };
}
