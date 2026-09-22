import { describe, expect, it } from "vitest";

import { createRepositoryImportResolverV1 } from "../src/runtime/repository-imports.js";

const resolver = (files: Array<{ relativePath: string; content: string }>) =>
  createRepositoryImportResolverV1(files);

describe("repository import resolver", () => {
  it("keeps the existing relative TypeScript probes", () => {
    const resolve = resolver([
      { relativePath: "src/main.ts", content: 'import "./helper.js"' },
      { relativePath: "src/helper.ts", content: "" },
    ]);
    expect(resolve("src/main.ts", "./helper.js")).toEqual(["src/helper.ts"]);
    expect(resolve("src/main.ts", "lodash")).toEqual([]);
  });

  it("resolves a Go module import to sorted package files and excludes tests", () => {
    const resolve = resolver([
      { relativePath: "go.mod", content: "// module\nmodule example.com/root\r\ngo 1.22\r\n" },
      { relativePath: "cmd/main.go", content: "package main" },
      { relativePath: "pkg/z.go", content: "package pkg" },
      { relativePath: "pkg/a.go", content: "package pkg" },
      { relativePath: "pkg/a_test.go", content: "package pkg" },
      { relativePath: "pkg/_ignored.go", content: "package pkg" },
      { relativePath: "pkg/.ignored.go", content: "package pkg" },
    ]);
    expect(resolve("cmd/main.go", "example.com/root/pkg")).toEqual(["pkg/a.go", "pkg/z.go"]);
    expect(resolve("cmd/main.go", "fmt")).toEqual([]);
    expect(resolve("cmd/main.go", "example.com/root-extra/pkg")).toEqual([]);
  });

  it("respects nested module boundaries in both directions", () => {
    const resolve = resolver([
      { relativePath: "go.mod", content: "module example.com/root\n" },
      { relativePath: "main.go", content: "package root" },
      { relativePath: "nested/go.mod", content: "module \"example.com/nested\" // quoted\n" },
      { relativePath: "nested/main.go", content: "package nested" },
      { relativePath: "nested/lib/lib.go", content: "package lib" },
    ]);
    expect(resolve("nested/main.go", "example.com/nested/lib")).toEqual(["nested/lib/lib.go"]);
    expect(resolve("main.go", "example.com/root/nested/lib")).toEqual([]);
    expect(resolve("nested/main.go", "example.com/root")).toEqual([]);
  });

  it("treats malformed or duplicate module directives as unknown while retaining a boundary", () => {
    const resolve = resolver([
      { relativePath: "go.mod", content: "module example.com/one\nmodule example.com/two\n" },
      { relativePath: "main.go", content: "package main" },
      { relativePath: "pkg/lib.go", content: "package pkg" },
    ]);
    expect(resolve("main.go", "example.com/one/pkg")).toEqual([]);
    expect(resolve("main.go", "example.com/two/pkg")).toEqual([]);
  });

  it("returns no edge for an importer outside every module", () => {
    const resolve = resolver([
      { relativePath: "service/go.mod", content: "module example.com/service\n" },
      { relativePath: "service/lib.go", content: "package service" },
      { relativePath: "loose.go", content: "package loose" },
    ]);
    expect(resolve("loose.go", "example.com/service")).toEqual([]);
  });
  it("does not turn invalid or foreign-language imports into TypeScript dependencies", () => {
    const resolve = resolver([
      { relativePath: "src/main.ts", content: "" },
      { relativePath: "src/main.go", content: "package main" },
      { relativePath: "src/main.py", content: "" },
      { relativePath: "src/helper.ts", content: "" },
      { relativePath: "src/.helper", content: "" },
    ]);
    expect(resolve("src/main.go", "./helper.js")).toEqual([]);
    expect(resolve("src/main.py", "./helper.js")).toEqual([]);
    expect(resolve("src/main.ts", " ./helper.js ")).toEqual([]);
    expect(resolve("src/main.ts", ".helper")).toEqual([]);
    expect(resolve("missing.ts", "./src/helper.ts")).toEqual([]);
  });

  it("retains malformed nested module boundaries and rejects path traversal", () => {
    const resolve = resolver([
      { relativePath: "go.mod", content: "module example.com/root\n" },
      { relativePath: "main.go", content: "package root" },
      { relativePath: "pkg/a.go", content: "package pkg" },
      { relativePath: "nested/go.mod", content: "module\n" },
      { relativePath: "nested/main.go", content: "package nested" },
    ]);
    expect(resolve("main.go", "example.com/root/nested")).toEqual([]);
    expect(resolve("nested/main.go", "example.com/root/pkg")).toEqual([]);
    expect(resolve("main.go", "example.com/root/pkg/../pkg")).toEqual([]);
    expect(resolve("main.go", "example.com/root//pkg")).toEqual([]);
  });

  it("resolves JSONC paths with inheritance, baseUrl and extension substitution", () => {
    const resolve = resolver([
      { relativePath: "tsconfig.base.json", content: '{/* source paths */ "compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"],},},}' },
      { relativePath: "tsconfig.json", content: '{"extends":"./tsconfig.base.json"}' },
      { relativePath: "src/main.ts", content: "" },
      { relativePath: "src/helper.ts", content: "" },
      { relativePath: "src/esm.mts", content: "" },
    ]);
    expect(resolve("src/main.ts", "@/helper.js")).toEqual(["src/helper.ts"]);
    expect(resolve("src/main.ts", "@/esm")).toEqual(["src/esm.mts"]);
    expect(resolve("src/main.ts", "../../outside")).toEqual([]);
  });

  it("keeps a nested project without extends from inheriting parent aliases", () => {
    const resolve = resolver([
      { relativePath: "tsconfig.json", content: '{"compilerOptions":{"paths":{"@/*":["src/*"]}}}' },
      { relativePath: "nested/tsconfig.json", content: '{}' },
      { relativePath: "nested/main.ts", content: "" },
      { relativePath: "src/helper.ts", content: "" },
    ]);
    expect(resolve("nested/main.ts", "@/helper")).toEqual([]);
  });

  it("resolves declared workspace exports through explicit compiler output mapping", () => {
    const resolve = resolver([
      { relativePath: "packages/app/package.json", content: '{"dependencies":{"@repo/lib":"workspace:*"}}' },
      { relativePath: "packages/app/main.ts", content: "" },
      { relativePath: "packages/lib/package.json", content: '{"name":"@repo/lib","exports":{".":{"types":"./dist/index.d.ts","default":"./dist/index.js"},"./other":"./src/other.ts"}}' },
      { relativePath: "packages/lib/tsconfig.json", content: '{"compilerOptions":{"rootDir":"src","outDir":"dist"}}' },
      { relativePath: "packages/lib/src/index.ts", content: "" },
      { relativePath: "packages/lib/src/other.ts", content: "" },
    ]);
    expect(resolve("packages/app/main.ts", "@repo/lib")).toEqual(["packages/lib/src/index.ts"]);
    expect(resolve("packages/app/main.ts", "@repo/lib/other")).toEqual(["packages/lib/src/other.ts"]);
    expect(resolve("packages/app/main.ts", "@repo/lib/private")).toEqual([]);
  });

  it("does not guess workspace bindings for ambiguous conditions, duplicate names or external dependencies", () => {
    const files = [
      { relativePath: "app/package.json", content: '{"dependencies":{"lib":"workspace:*"}}' },
      { relativePath: "app/main.ts", content: "" },
      { relativePath: "lib/package.json", content: '{"name":"lib","exports":{"import":"./one.ts","require":"./two.ts"}}' },
      { relativePath: "lib/one.ts", content: "" },
      { relativePath: "lib/two.ts", content: "" },
    ];
    expect(resolver(files)("app/main.ts", "lib")).toEqual([]);
    files[2].content = '{"name":"lib","exports":"./one.ts"}';
    files[0].content = '{"dependencies":{"lib":"^1.0.0"}}';
    expect(resolver(files)("app/main.ts", "lib")).toEqual([]);
    files[0].content = '{"dependencies":{"lib":"workspace:*"}}';
    files.push({ relativePath: "fixture/package.json", content: '{"name":"lib"}' });
    expect(resolver(files)("app/main.ts", "lib")).toEqual([]);
  });

  it("rejects configuration escapes and unresolved extends instead of inventing aliases", () => {
    const files = [
      { relativePath: "tsconfig.json", content: '{"compilerOptions":{"baseUrl":"../outside","paths":{"@/*":["src/*"]}}}' },
      { relativePath: "src/main.ts", content: "" },
      { relativePath: "src/helper.ts", content: "" },
    ];
    expect(resolver(files)("src/main.ts", "@/helper")).toEqual([]);
    files[0].content = '{"extends":"some-package","compilerOptions":{"paths":{"@/*":["src/*"]}}}';
    expect(resolver(files)("src/main.ts", "@/helper")).toEqual([]);
    files[0].content = '{"compilerOptions":{"paths":{"helper":["src/helper*.ts"]}}}';
    expect(resolver(files)("src/main.ts", "helper")).toEqual([]);
  });

});
