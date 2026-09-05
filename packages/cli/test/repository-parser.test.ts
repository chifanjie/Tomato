import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { builtinModules } from "node:module";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { build } from "esbuild";
import type { CallGraphEntry } from "@understand-code/core";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, "..");

interface ParserProbeResult {
  readonly typescript: {
    readonly functions: Array<{ readonly name: string }>;
    readonly imports: Array<{ readonly source: string }>;
    readonly calls: CallGraphEntry[];
  };
  readonly go: {
    readonly functions: Array<{ readonly name: string }>;
    readonly imports: Array<{ readonly source: string }>;
    readonly calls: CallGraphEntry[];
  };
}

describe("production repository parser bundle", () => {
  it("parses TypeScript and Go from embedded fixed assets without node_modules", async () => {
    // The encoder is the same release helper used by build-bundle.mjs. Keep
    // this test bound to the production asset inventory rather than copying a
    // second fixture representation into the test.
    const { encodeRepositoryParserAssetsV1 } = await import(
      new URL("../scripts/parser-assets.mjs", import.meta.url).href,
    );
    const encodedAssets = await encodeRepositoryParserAssetsV1();
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "understand-code-parser-bundle-"));
    const bundlePath = path.join(temporaryRoot, "parser-probe.mjs");
    try {
      const source = `
        import { repositoryParserRegistryV1 } from ${JSON.stringify(path.join(packageRoot, "src/runtime/repository-parser.ts"))};
        const registry = await repositoryParserRegistryV1();
        const typescript = registry.analyzeFile(
          "src/index.ts",
          "import { helper } from './helper';\\nexport function run(): string { return helper(); }",
        );
        const go = registry.analyzeFile(
          "cmd/main.go",
          'package main\\n\\nimport "fmt"\\n\\nfunc Run() { fmt.Println("ok") }',
        );
        process.stdout.write(JSON.stringify({
          typescript: {
            functions: typescript?.functions.map(({ name }) => ({ name })) ?? [],
            imports: typescript?.imports.map(({ source }) => ({ source })) ?? [],
            calls: registry.extractCallGraph("src/index.ts", "import { helper } from './helper';\\nexport function run() { return helper(); }"),
          },
          go: {
            functions: go?.functions.map(({ name }) => ({ name })) ?? [],
            imports: go?.imports.map(({ source }) => ({ source })) ?? [],
            calls: registry.extractCallGraph("cmd/main.go", 'package main\\nimport "fmt"\\nfunc Run() { fmt.Println("ok") }'),
          },
        }));
      `;
      const result = await build({
        stdin: {
          contents: source,
          resolveDir: packageRoot,
          sourcefile: "repository-parser-probe.ts",
          loader: "ts",
        },
        outfile: bundlePath,
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node22",
        write: true,
        define: {
          __UNDERSTAND_CODE_PARSER_ASSETS_V1__: JSON.stringify(encodedAssets),
        },
        banner: {
          js: [
            "#!/usr/bin/env node",
            'import { createRequire as __understandCreateRequire } from "node:module";',
            "const require = __understandCreateRequire(import.meta.url);",
          ].join("\n"),
        },
        metafile: true,
      });
      const externalImports = Object.values(result.metafile?.outputs ?? {})
        .flatMap((output) => output.imports)
        .filter((entry) =>
          entry.external &&
          !entry.path.startsWith("node:") &&
          !builtinModules.includes(entry.path),
        );
      expect(externalImports).toEqual([]);

      const { stdout, stderr } = await execFileAsync(process.execPath, [bundlePath], {
        cwd: temporaryRoot,
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: temporaryRoot, NODE_PATH: "" },
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
        timeout: 15_000,
      });
      expect(stderr).toBe("");
      const parsed = JSON.parse(stdout) as ParserProbeResult;
      expect(parsed.typescript.functions.map(({ name }) => name)).toContain("run");
      expect(parsed.typescript.imports.map(({ source }) => source)).toContain("./helper");
      expect(parsed.go.functions.map(({ name }) => name)).toContain("Run");
      expect(parsed.go.imports.map(({ source }) => source)).toContain("fmt");
      expect(parsed.typescript.calls).toContainEqual(expect.objectContaining({
        caller: "run", callee: "helper", binding: { kind: "import", source: "./helper", name: "helper" },
      }));
      expect(parsed.go.calls).toContainEqual(expect.objectContaining({
        caller: "Run", callee: "fmt.Println",
        binding: { kind: "import", source: "fmt", name: "Println", packageName: "fmt" },
      }));

      // The probe must be self-contained. Reading the bundle also guards the
      // test against accidentally replacing the embedded assets with a path
      // or package lookup.
      const bundle = await readFile(bundlePath, "utf8");
      expect(bundle).toContain("Fixed repository parser inventory");
      expect(bundle).toContain("web-tree-sitter/web-tree-sitter.wasm");
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }, 60_000);
});
