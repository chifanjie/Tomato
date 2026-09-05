import { describe, expect, it } from "vitest";
import { resolveCalls, type CallResolverFile } from "./call-resolver.js";

function files(): CallResolverFile[] {
  return [{ path: "src/main.ts", imports: [
    { source: "./helper.js", specifiers: ["renamed"], lineNumber: 1, resolvedPaths: ["src/helper.ts"] },
  ], functions: [
    { name: "main", startLine: 2, endLine: 10 },
    { name: "local", startLine: 11, endLine: 13 },
  ], callGraph: [
    { caller: "main", callee: "local", lineNumber: 3, binding: { kind: "local", name: "local" } },
    { caller: "main", callee: "renamed", lineNumber: 4,
      binding: { kind: "import", source: "./helper.js", name: "helper" } },
  ] }, { path: "src/helper.ts", imports: [],
    functions: [{ name: "implementation", startLine: 1, endLine: 3 }],
    callableExports: [{ name: "helper", localName: "implementation" }], callGraph: [],
  }];
}

describe("resolveCalls", () => {
  it("resolves AST-bound local and aliased imported calls with source lines", () => {
    expect(resolveCalls(files())).toEqual({ calls: [
      { callerFile: "src/main.ts", callerFunc: "main", calleeFile: "src/main.ts",
        calleeFunc: "local", confidence: "same-file", lineNumber: 3 },
      { callerFile: "src/main.ts", callerFunc: "main", calleeFile: "src/helper.ts",
        calleeFunc: "implementation", confidence: "imported-package", lineNumber: 4 },
    ], unresolved: [] });
  });

  it("never guesses a local, qualified, or unique project-wide function without a binding", () => {
    const input = files();
    input[0].callGraph = ["local", "helper.implementation", "UniqueGlobal"].map((callee) => ({
      caller: "main", callee, lineNumber: 4,
    }));
    input.push({ path: "other/pkg.go", imports: [], packageName: "unrelated",
      functions: [{ name: "UniqueGlobal", startLine: 1, endLine: 1 }], callGraph: [] });
    expect(resolveCalls(input).calls).toEqual([]);
    expect(resolveCalls(input).unresolved).toHaveLength(3);
  });

  it.each(["unresolved import", "not exported", "ambiguous export", "missing function",
    "ambiguous function", "unknown caller", "ambiguous caller", "outside caller", "invalid line"])(
    "leaves %s unresolved", (reason) => {
      const input = files();
      input[0].callGraph = [input[0].callGraph[1]];
      if (reason === "unresolved import") input[0].imports[0].resolvedPaths = [];
      if (reason === "not exported") input[1].callableExports = [];
      if (reason === "ambiguous export") input[1].callableExports!.push({ name: "helper", localName: "implementation" });
      if (reason === "missing function") input[1].functions = [];
      if (reason === "ambiguous function") input[1].functions.push(input[1].functions[0]);
      if (reason === "unknown caller") input[0].callGraph[0].caller = "nested";
      if (reason === "ambiguous caller") input[0].functions.push(input[0].functions[0]);
      if (reason === "outside caller") input[0].callGraph[0].lineNumber = 20;
      if (reason === "invalid line") input[0].callGraph[0].lineNumber = 4.5;
      expect(resolveCalls(input).calls).toEqual([]);
      expect(resolveCalls(input).unresolved).toHaveLength(1);
    });

  it("rejects ambiguous target files, while deduplicating repeated import records", () => {
    const input = files();
    input[0].callGraph = [input[0].callGraph[1]];
    input[0].imports.push(input[0].imports[0]);
    expect(resolveCalls(input).calls).toHaveLength(1);
    input.push({ ...input[1], path: "src/alternative.ts" });
    input[0].imports[0].resolvedPaths = ["src/helper.ts", "src/alternative.ts"];
    expect(resolveCalls(input).calls).toEqual([]);
  });
  it("resolves Go package functions only in the same directory and package", () => {
    const goFile = (path: string, scope: string, name: string): CallResolverFile => ({
      path, packageScope: scope, packageName: "worker", callableFunctions: [name],
      functions: [{ name, startLine: 1, endLine: 10 }], imports: [], callGraph: [],
    });
    const input = [goFile("src/main.go", "src\0worker", "Main"),
      goFile("src/helper.go", "src\0worker", "helper"),
      goFile("other/helper.go", "other\0worker", "helper")];
    input[0].callGraph = [{ caller: "Main", callee: "helper", lineNumber: 3,
      binding: { kind: "package", name: "helper" } }];
    expect(resolveCalls(input).calls).toContainEqual(expect.objectContaining({ calleeFile: "src/helper.go" }));
    input[1].path = "src/helper_test.go";
    expect(resolveCalls(input).calls).toEqual([]);
    input[0].path = "src/main_test.go";
    expect(resolveCalls(input).calls).toHaveLength(1);
    input[1].callableFunctions = [];
    expect(resolveCalls(input).calls).toEqual([]);
  });

  it("checks the actual Go package clause for default imports", () => {
    const input = files();
    input[0].callGraph = [{ caller: "main", callee: "helper.helper", lineNumber: 4,
      binding: { kind: "import", source: "./helper.js", name: "helper", packageName: "helper" } }];
    input[1].packageName = "different";
    expect(resolveCalls(input).calls).toEqual([]);
    input[1].packageName = "helper";
    expect(resolveCalls(input).calls).toHaveLength(1);
  });

  it("does not equate an imported foreign-language symbol with a TypeScript binding", () => {
    const input = files();
    input[0].callGraph = [input[0].callGraph[1]];
    input[0].imports[0].resolvedPaths = ["src/helper.go"];
    input[1].path = "src/helper.go";
    expect(resolveCalls(input).calls).toEqual([]);
  });

});
