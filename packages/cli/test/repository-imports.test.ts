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

});
