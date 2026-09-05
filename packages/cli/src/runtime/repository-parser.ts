import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { brotliDecompressSync } from "node:zlib";

import { PluginRegistry, TreeSitterPlugin } from "@understand-code/core";
import { builtinLanguageConfigs } from "@understand-code/core/languages";

interface EncodedParserAssetsV1 {
  readonly schemaVersion: 1;
  readonly runtime: string;
  readonly languages: Readonly<Record<string, string>>;
  readonly data: string;
  readonly assets: Readonly<Record<string, {
    readonly offset: number;
    readonly bytes: number;
    readonly sha256: string;
  }>>;
}

declare const __UNDERSTAND_CODE_PARSER_ASSETS_V1__: EncodedParserAssetsV1 | undefined;

const RUNTIME = "web-tree-sitter/web-tree-sitter.wasm";
const configs = builtinLanguageConfigs.filter((config) => config.treeSitter !== undefined);
const languages: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(configs.map((config) => [config.id,
    `${config.treeSitter!.wasmPackage}/${config.treeSitter!.wasmFile}`])),
  tsx: "tree-sitter-typescript/tree-sitter-tsx.wasm",
});
const specifiers = [...new Set([RUNTIME, ...Object.values(languages)])].sort();

function sameEntries(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>): boolean {
  return JSON.stringify(Object.entries(left).sort()) === JSON.stringify(Object.entries(right).sort());
}

function requireWasm(bytes: Buffer): Buffer {
  if (bytes.length < 8 || bytes.length > 8 * 1024 * 1024 ||
    !bytes.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]))) {
    throw new Error("Invalid fixed repository parser WASM");
  }
  return bytes;
}

async function loadAssets(): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();
  if (typeof __UNDERSTAND_CODE_PARSER_ASSETS_V1__ !== "undefined") {
    const encoded = __UNDERSTAND_CODE_PARSER_ASSETS_V1__;
    if (encoded?.schemaVersion !== 1 || encoded.runtime !== RUNTIME ||
      !sameEntries(encoded.languages, languages) ||
      JSON.stringify(Object.keys(encoded.assets).sort()) !== JSON.stringify(specifiers)) {
      throw new Error("Fixed repository parser inventory mismatch");
    }
    let totalBytes = 0;
    for (const specifier of specifiers) {
      const asset = encoded.assets[specifier]!;
      if (asset.offset !== totalBytes || !Number.isSafeInteger(asset.bytes) || asset.bytes < 8 || asset.bytes > 8 * 1024 * 1024 ||
        !/^[0-9a-f]{64}$/u.test(asset.sha256)) throw new Error("Invalid fixed repository parser asset");
      totalBytes += asset.bytes;
      if (totalBytes > 24 * 1024 * 1024) throw new Error("Fixed repository parser inventory exceeds its bound");
    }
    const contents = brotliDecompressSync(Buffer.from(encoded.data, "base64"), { maxOutputLength: totalBytes });
    if (contents.length !== totalBytes) throw new Error("Fixed repository parser inventory is truncated");
    for (const specifier of specifiers) {
      const asset = encoded.assets[specifier]!;
      const bytes = requireWasm(contents.subarray(asset.offset, asset.offset + asset.bytes));
      if (bytes.length !== asset.bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
        throw new Error("Fixed repository parser digest mismatch");
      }
      result.set(specifier, bytes);
    }
  } else {
    // Unbundled source/tests load exactly the same declared package assets.
    // esbuild replaces the constant and removes this branch from installed CLIs.
    const localRequire = createRequire(import.meta.url);
    const coreRequire = createRequire(localRequire.resolve("@understand-code/core"));
    for (const specifier of specifiers) result.set(specifier, requireWasm(await readFile(coreRequire.resolve(specifier))));
  }
  if ([...result.values()].reduce((sum, bytes) => sum + bytes.length, 0) > 24 * 1024 * 1024) {
    throw new Error("Fixed repository parser inventory exceeds its bound");
  }
  return result;
}

let registryPromise: Promise<PluginRegistry> | undefined;

export function repositoryParserRegistryV1(): Promise<PluginRegistry> {
  registryPromise ??= (async () => {
    const assets = await loadAssets();
    const plugin = new TreeSitterPlugin(configs, undefined, { wasm: {
      runtime: assets.get(RUNTIME)!,
      languages: Object.fromEntries(Object.entries(languages).map(([language, specifier]) => [language, assets.get(specifier)!])),
    } });
    await plugin.init();
    const registry = new PluginRegistry();
    registry.register(plugin);
    return registry;
  })();
  return registryPromise;
}
