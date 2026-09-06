import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { TypeScriptExtractor } from "../typescript-extractor.js";

const require = createRequire(import.meta.url);
let Parser: any;
let Language: any;
let typescriptLang: any;

beforeAll(async () => {
  const mod = await import("web-tree-sitter");
  Parser = mod.Parser;
  Language = mod.Language;
  await Parser.init();
  typescriptLang = await Language.load(require.resolve("tree-sitter-typescript/tree-sitter-typescript.wasm"));
});

function parse(code: string) {
  const parser = new Parser();
  parser.setLanguage(typescriptLang);
  const tree = parser.parse(code);
  return { parser, tree, root: tree.rootNode };
}

describe("TypeScriptExtractor static call bindings", () => {
  const extractor = new TypeScriptExtractor();

  it("extracts runtime re-exports, preserving aliases and excluding type-only exports", () => {
    const { parser, tree, root } = parse([
      'import { original as imported } from "./impl.js";',
      'export { imported as forwarded };',
      'export { original as renamed, default as main } from "./impl.js";',
      'export * from "./more.js";',
      'export * as namespace from "./impl.js";',
      'export type { TypeOnly } from "./types.js";',
      'export { type TypeOnly, runtime } from "./mixed.js";',
      'function local() {}',
      'export type { local };',
    ].join("\n"));
    try {
      expect(root.hasError).toBe(false);
      const structure = extractor.extractStructure(root);
      expect(structure.reExports).toEqual([
        { source: "./impl.js", name: "forwarded", importedName: "original", lineNumber: 2 },
        { source: "./impl.js", name: "renamed", importedName: "original", lineNumber: 3 },
        { source: "./impl.js", name: "main", importedName: "default", lineNumber: 3 },
        { source: "./more.js", name: "*", importedName: "*", lineNumber: 4 },
        { source: "./impl.js", name: "namespace", importedName: "*", lineNumber: 5 },
        { source: "./mixed.js", name: "runtime", importedName: "runtime", lineNumber: 7 },
      ]);
      expect(structure.imports).toContainEqual({ source: "./more.js", specifiers: [], lineNumber: 4 });
      expect(structure.callableExports).toEqual([]);
      expect(structure.exports).toEqual(expect.arrayContaining([
        { name: "forwarded", lineNumber: 2 },
        { name: "renamed", lineNumber: 3 },
        { name: "main", lineNumber: 3 },
        { name: "TypeOnly", lineNumber: 6, isTypeOnly: true },
        { name: "runtime", lineNumber: 7 },
        { name: "local", lineNumber: 9, isTypeOnly: true },
      ]));
    } finally { tree.delete(); parser.delete(); }
  });

  it("records runtime enum and namespace exports so star exports cannot shadow them", () => {
    const { parser, tree, root } = parse([
      "export enum helper { A }",
      "export namespace namespaceHelper { export function run() {} }",
      "export module moduleHelper { export function run() {} }",
    ].join("\n"));
    try {
      expect(extractor.extractStructure(root).exports).toEqual([
        { name: "helper", lineNumber: 1 },
        { name: "namespaceHelper", lineNumber: 2 },
        { name: "moduleHelper", lineNumber: 3 },
      ]);
    } finally { tree.delete(); parser.delete(); }
  });

  it("keeps a runtime export when a type-only export with the same name appears first", () => {
    const { parser, tree, root } = parse([
      'export type { helper } from "./types.js";',
      "export const helper = () => 1;",
    ].join("\n"));
    try {
      expect(extractor.extractStructure(root).exports).toEqual([
        { name: "helper", lineNumber: 1, isTypeOnly: true },
        { name: "helper", lineNumber: 2 },
      ]);
    } finally { tree.delete(); parser.delete(); }
  });

  it("binds local functions and named, aliased, default, and namespace imports", () => {
    const { parser, tree, root } = parse(`
      import def, { twice as renamed, plain } from "./helper.js";
      import * as ns from "./ns.js";
      function local() {}
      const runner = () => { local(); renamed(); plain(); def(); ns.work(); unknown(); };
    `);
    expect(extractor.extractCallGraph(root)).toEqual([
      { caller: "runner", callee: "local", lineNumber: 5, binding: { kind: "local", name: "local" } },
      { caller: "runner", callee: "renamed", lineNumber: 5, binding: { kind: "import", source: "./helper.js", name: "twice" } },
      { caller: "runner", callee: "plain", lineNumber: 5, binding: { kind: "import", source: "./helper.js", name: "plain" } },
      { caller: "runner", callee: "def", lineNumber: 5, binding: { kind: "import", source: "./helper.js", name: "default" } },
      { caller: "runner", callee: "ns.work", lineNumber: 5, binding: { kind: "import", source: "./ns.js", name: "work" } },
      { caller: "runner", callee: "unknown", lineNumber: 5 },
    ]);
    tree.delete(); parser.delete();
  });

  it("omits bindings for shadowing, type-only imports, and rebinding", () => {
    const { parser, tree, root } = parse(`
      import { helper } from "./helper.js";
      import type { TypeOnly } from "./types.js";
      function helperLocal() {
        helper();
        { const helper = 1; helper(); }
        try { helper(); } catch (helper) { helper(); }
        helper = other;
      }
    `);
    const calls = extractor.extractCallGraph(root);
    expect(calls.map((call) => call.binding)).toEqual([undefined, undefined, undefined, undefined]);
    tree.delete(); parser.delete();
  });

  it("reports only statically bound callable exports and excludes re-exports", () => {
    const { parser, tree, root } = parse(`
      import { x } from "other";
      export function named() {}
      function local() {}
      const arrow = () => {};
      export { local as renamed, arrow as default };
      export { x as external } from "other";
    `);
    expect(extractor.extractStructure(root).callableExports).toEqual([
      { name: "named", localName: "named" },
      { name: "renamed", localName: "local" },
      { name: "default", localName: "arrow" },
    ]);
    tree.delete(); parser.delete();
  });

  it("does not bind nested callbacks, hoisted locals, or names that can be rebound elsewhere", () => {
    const { parser, tree, root } = parse(`
      import * as ns from "pkg";
      function helper() {}
      function rebinds() { helper = other; }
      function outer() {
        if (true) { var helper = other; }
        helper();
        ns.run(() => { helper(); ns.inner(); });
      }
    `);
    const calls = extractor.extractCallGraph(root);
    expect(calls.filter((call) => call.caller === "outer")).toEqual([
      { caller: "outer", callee: "helper", lineNumber: 7 },
      { caller: "outer", callee: "ns.run", lineNumber: 8, binding: { kind: "import", source: "pkg", name: "run" } },
      { caller: "outer", callee: "helper", lineNumber: 8 },
      { caller: "outer", callee: "ns.inner", lineNumber: 8 },
    ]);
    tree.delete(); parser.delete();
  });

  it.each([
    ["parameter", `function target(helper) { helper(); }`, "target"],
    ["destructured parameter", `function target({ helper }) { helper(); }`, "target"],
    ["catch parameter", `function target() { try {} catch (helper) { helper(); } helper(); }`, "target"],
    ["block shadow", `function target() { { const helper = 1; helper(); } helper(); }`, "target"],
    ["var hoist", `function target() { if (true) { var helper = other; } helper(); }`, "target"],
    ["for-of binding", `function target() { for (const helper of values) helper(); helper(); }`, "target"],
    ["namespace parameter", `function target(ns) { ns.run(); }`, "target"],
    ["type-only import", `import type { helper } from "types"; function target() { helper(); }`, "target"],
    ["nested same-name function", `function target() { function helper() {} helper(); }`, "target"],
    ["anonymous callback", `function target() { run(() => helper()); }`, "target"],
    ["assignment in another function", `function target() { helper = other; }`, "safe"],
  ] as const)("does not guess %s bindings", (_label, body, _caller) => {
    const hasTypeOnlyImport = body.startsWith("import type");
    const code = `${hasTypeOnlyImport ? "" : `import { helper } from \"pkg\"; import * as ns from \"pkg\";`}\n${body}\nfunction safe() { helper(); ns.safe(); }`;
    const { parser, tree, root } = parse(code);
    expect(root.hasError).toBe(false);
    const calls = extractor.extractCallGraph(root);
    const targetCalls = calls.filter((call) => call.caller === "target");
    if (_label === "block shadow" || _label === "catch parameter" || _label === "for-of binding") {
      expect(targetCalls.some((call) => call.callee === "helper" && call.binding)).toBe(true);
    } else if (_label === "anonymous callback") {
      expect(targetCalls.find((call) => call.callee === "helper")?.binding).toBeUndefined();
    } else if (_label !== "assignment in another function") {
      expect(targetCalls.some((call) => call.callee === "helper" && call.binding)).toBe(false);
    }
    if (_label === "assignment in another function") {
      expect(calls.find((call) => call.caller === "safe" && call.callee === "helper")?.binding).toBeUndefined();
    } else if (!hasTypeOnlyImport) {
      expect(calls.find((call) => call.caller === "safe" && call.callee === "helper")?.binding).toEqual({ kind: "import", source: "pkg", name: "helper" });
    }
    tree.delete(); parser.delete();
  });

  it("does not bind a function name redeclared by a non-callable top-level variable", () => {
    const { parser, tree, root } = parse(`
      function helper() {}
      var helper = other;
      function target() { helper(); }
    `);
    expect(root.hasError).toBe(false);
    expect(extractor.extractCallGraph(root).find((call) => call.callee === "helper")?.binding).toBeUndefined();
    tree.delete(); parser.delete();
  });
  it.each([
    "const replace = () => { helper = replacement; };",
    "class Replacer { replace() { helper = replacement; } }",
  ])("rejects a function rebound inside another callable: %s", (declaration) => {
    const { parser, tree, root } = parse(`
      import { untouched } from "./other.js";
      function helper() {}
      ${declaration}
      function main() { helper(); untouched(); }
    `);
    try {
      expect(root.hasError).toBe(false);
      const calls = extractor.extractCallGraph(root).filter((call) => call.caller === "main");
      expect(calls.find((call) => call.callee === "helper")?.binding).toBeUndefined();
      expect(calls.find((call) => call.callee === "untouched")?.binding).toEqual({
        kind: "import", source: "./other.js", name: "untouched",
      });
    } finally {
      tree.delete(); parser.delete();
    }
  });

});
