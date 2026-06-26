import { describe, expect, it } from "vitest";
import { resolveCalls } from "./call-resolver.js";
import type { CallResolverFile } from "./call-resolver.js";

const files: CallResolverFile[] = [
  {
    path: "src/a.go",
    packageName: "core",
    imports: [{ source: "src/b.go", specifiers: ["helper"], lineNumber: 3 }],
    functions: [
      { name: "Build", startLine: 10, endLine: 20 },
      { name: "Filter", startLine: 22, endLine: 30 },
    ],
    callGraph: [
      { caller: "Build", callee: "Filter", lineNumber: 12 },
      { caller: "Build", callee: "helper.Load", lineNumber: 13 },
    ],
  },
  {
    path: "src/b.go",
    packageName: "helper",
    imports: [],
    functions: [{ name: "Load", startLine: 5, endLine: 9 }],
    callGraph: [],
  },
];

describe("resolveCalls", () => {
  it("resolves same-file calls", () => {
    const result = resolveCalls(files);
    expect(result.calls).toContainEqual({
      callerFile: "src/a.go",
      callerFunc: "Build",
      calleeFile: "src/a.go",
      calleeFunc: "Filter",
      confidence: "same-file",
      lineNumber: 12,
    });
  });

  it("resolves imported package selector calls", () => {
    const result = resolveCalls(files);
    expect(result.calls).toContainEqual({
      callerFile: "src/a.go",
      callerFunc: "Build",
      calleeFile: "src/b.go",
      calleeFunc: "Load",
      confidence: "imported-package",
      lineNumber: 13,
    });
  });

  it("counts unresolved calls without emitting graph edges", () => {
    const result = resolveCalls([
      {
        path: "src/a.go",
        packageName: "core",
        imports: [],
        functions: [{ name: "Build", startLine: 1, endLine: 5 }],
        callGraph: [{ caller: "Build", callee: "unknown.Missing", lineNumber: 3 }],
      },
    ]);

    expect(result.calls).toEqual([]);
    expect(result.unresolved).toEqual([{ file: "src/a.go", caller: "Build", callee: "unknown.Missing", lineNumber: 3 }]);
  });
});
