# Call Graph Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit real function-level `calls` edges so the Phase 1 function detail page can show precise downstream and upstream impact instead of import-based estimates.

**Architecture:** Reuse the existing `CallGraphEntry`, `extractCallGraph`, and `GraphBuilder.addCallEdge()` support already present in the codebase. Add a deterministic resolver that maps raw callee text such as `LoadData`, `svc.Fetch`, or `pkg.Build` to existing `function:<file>:<name>` node ids, then connect the resolver into the `/understand` structure extraction and graph assembly flow.

**Tech Stack:** TypeScript, Node ESM scripts, Tree-sitter extractors, Vitest.

---

## Local Scope

Work only in `/Users/example/understand-code`. This folder is intentionally not a Git repository.

Phase 2 depends on Phase 1 only at the UX level: Phase 1 can display import-estimated impact without Phase 2. After Phase 2 emits `calls` edges, Phase 1 automatically switches `FunctionImpact.source` from `imports` to `calls`.

## Existing Support

The bottom layer already has most of the pieces:

- `packages/core/src/types.ts` defines edge type `calls`.
- `packages/core/src/types.ts` defines `CallGraphEntry`.
- `packages/core/src/types.ts` allows `AnalyzerPlugin.extractCallGraph`.
- `packages/core/src/plugins/registry.ts` exposes `extractCallGraph`.
- `packages/core/src/plugins/extractors/go-extractor.ts` extracts caller/callee entries from Go ASTs.
- `packages/core/src/analyzer/graph-builder.ts` already has `addCallEdge(callerFile, callerFunc, calleeFile, calleeFunc)`.
- `skills/understand/extract-structure.mjs` already includes `callGraph` in extraction output when available.

The missing piece is deterministic resolution and assembly: raw callee strings are extracted, but the final graph generation path does not reliably turn them into `calls` edges.

## File Structure

Create these files:

- `packages/core/src/analyzer/call-resolver.ts`: pure resolver from structure extraction records to resolved function calls.
- `packages/core/src/analyzer/call-resolver.test.ts`: tests same-file calls, imported package calls, selector calls, and unresolved calls.

Modify these files:

- `packages/core/src/index.ts`: export resolver types if dashboard or scripts need them.
- `skills/understand/extract-structure.mjs`: include enough import/package metadata for resolver input.
- `skills/understand/SKILL.md`: update graph assembly instructions so the generated graph includes resolved `calls` edges.
- `packages/core/src/analyzer/graph-builder.test.ts`: add an assertion that `addCallEdge` still deduplicates and points to function node ids.

## Resolver Contract

Input is a list of extracted file records:

```ts
export interface CallResolverFile {
  path: string;
  packageName?: string;
  imports: Array<{ source: string; specifiers: string[]; lineNumber: number }>;
  functions: Array<{ name: string; startLine: number; endLine: number }>;
  callGraph: Array<{ caller: string; callee: string; lineNumber: number }>;
}
```

Output is a list of resolved calls:

```ts
export interface ResolvedCall {
  callerFile: string;
  callerFunc: string;
  calleeFile: string;
  calleeFunc: string;
  confidence: "exact" | "same-file" | "imported-package";
  lineNumber: number;
}
```

Resolution order:

1. Same-file function name match: `Build()` inside `a.go` resolves to `function:a.go:Build`.
2. Selector against same-file receiver or local package alias when resolvable: `svc.Fetch()` resolves only when `Fetch` is unique in the imported target file set.
3. Imported package function match: `pkg.Build()` resolves to files imported by current file whose package or import alias is `pkg`.
4. Unique project-wide exported function match is allowed only for exported Go names and only when exactly one candidate exists.
5. Unresolved calls are omitted from graph edges and counted in resolver diagnostics.

## Task 1: Add Resolver Tests

**Files:**
- Create: `packages/core/src/analyzer/call-resolver.test.ts`

- [ ] **Step 1: Add same-file and imported-call tests**

```ts
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
```

- [ ] **Step 2: Run the failing resolver tests**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-code/core test -- src/analyzer/call-resolver.test.ts
```

Expected result: the command fails because `call-resolver.ts` does not exist yet.

## Task 2: Implement the Pure Resolver

**Files:**
- Create: `packages/core/src/analyzer/call-resolver.ts`

- [ ] **Step 1: Add resolver types and helpers**

```ts
export interface CallResolverFile {
  path: string;
  packageName?: string;
  imports: Array<{ source: string; specifiers: string[]; lineNumber: number }>;
  functions: Array<{ name: string; startLine: number; endLine: number }>;
  callGraph: Array<{ caller: string; callee: string; lineNumber: number }>;
}

export interface ResolvedCall {
  callerFile: string;
  callerFunc: string;
  calleeFile: string;
  calleeFunc: string;
  confidence: "exact" | "same-file" | "imported-package";
  lineNumber: number;
}

export interface UnresolvedCall {
  file: string;
  caller: string;
  callee: string;
  lineNumber: number;
}

export interface ResolveCallsResult {
  calls: ResolvedCall[];
  unresolved: UnresolvedCall[];
}

function splitSelector(callee: string): { qualifier: string | null; name: string } {
  const parts = callee.split(".");
  if (parts.length < 2) return { qualifier: null, name: callee };
  return { qualifier: parts.slice(0, -1).join("."), name: parts[parts.length - 1] };
}

function isExportedGoName(name: string): boolean {
  return /^[A-Z]/.test(name);
}
```

- [ ] **Step 2: Add resolution logic**

```ts
export function resolveCalls(files: CallResolverFile[]): ResolveCallsResult {
  const calls: ResolvedCall[] = [];
  const unresolved: UnresolvedCall[] = [];
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const functionsByFile = new Map(files.map((file) => [file.path, new Set(file.functions.map((fn) => fn.name))]));
  const filesByPackage = new Map<string, CallResolverFile[]>();

  for (const file of files) {
    if (!file.packageName) continue;
    const list = filesByPackage.get(file.packageName) ?? [];
    list.push(file);
    filesByPackage.set(file.packageName, list);
  }

  for (const file of files) {
    for (const entry of file.callGraph) {
      const parsed = splitSelector(entry.callee);
      const sameFileFunctions = functionsByFile.get(file.path) ?? new Set<string>();

      if (!parsed.qualifier && sameFileFunctions.has(parsed.name)) {
        calls.push({
          callerFile: file.path,
          callerFunc: entry.caller,
          calleeFile: file.path,
          calleeFunc: parsed.name,
          confidence: "same-file",
          lineNumber: entry.lineNumber,
        });
        continue;
      }

      if (parsed.qualifier) {
        const importedTargets = file.imports
          .filter((imp) => imp.specifiers.includes(parsed.qualifier) || filesByPath.get(imp.source)?.packageName === parsed.qualifier)
          .map((imp) => filesByPath.get(imp.source))
          .filter((target): target is CallResolverFile => Boolean(target));

        const matches = importedTargets.filter((target) => functionsByFile.get(target.path)?.has(parsed.name));
        if (matches.length === 1) {
          calls.push({
            callerFile: file.path,
            callerFunc: entry.caller,
            calleeFile: matches[0].path,
            calleeFunc: parsed.name,
            confidence: "imported-package",
            lineNumber: entry.lineNumber,
          });
          continue;
        }
      }

      if (!parsed.qualifier && isExportedGoName(parsed.name)) {
        const projectMatches = files.filter((candidate) => functionsByFile.get(candidate.path)?.has(parsed.name));
        if (projectMatches.length === 1) {
          calls.push({
            callerFile: file.path,
            callerFunc: entry.caller,
            calleeFile: projectMatches[0].path,
            calleeFunc: parsed.name,
            confidence: "exact",
            lineNumber: entry.lineNumber,
          });
          continue;
        }
      }

      unresolved.push({ file: file.path, caller: entry.caller, callee: entry.callee, lineNumber: entry.lineNumber });
    }
  }

  return { calls, unresolved };
}
```

- [ ] **Step 3: Run resolver tests**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-code/core test -- src/analyzer/call-resolver.test.ts
```

Expected result: resolver tests pass.

## Task 3: Export Resolver Types

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Export resolver symbols**

Add:

```ts
export {
  resolveCalls,
  type CallResolverFile,
  type ResolveCallsResult,
  type ResolvedCall,
  type UnresolvedCall,
} from "./analyzer/call-resolver.js";
```

- [ ] **Step 2: Run core build**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-code/core build
```

Expected result: TypeScript build passes and `dist/index.d.ts` exposes the resolver symbols.

## Task 4: Preserve Package Metadata in Extraction Output

**Files:**
- Modify: `skills/understand/extract-structure.mjs`

- [ ] **Step 1: Add `packageName` extraction for Go files**

Inside the per-file loop, after reading `content`, derive package name:

```js
function extractGoPackageName(filePath, content) {
  if (!filePath.endsWith('.go')) return undefined;
  const match = content.match(/^\s*package\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/m);
  return match ? match[1] : undefined;
}
```

Add `packageName` to `base` in `buildResult` by passing it as an extra parameter:

```js
const packageName = extractGoPackageName(file.path, content);
const result = buildResult(file, totalLines, nonEmptyLines, analysis, callGraph, batchImportData, packageName);
```

Update `buildResult` signature:

```js
export function buildResult(file, totalLines, nonEmptyLines, analysis, callGraph, batchImportData, packageName) {
  const base = {
    path: file.path,
    language: file.language,
    fileCategory: file.fileCategory,
    totalLines,
    nonEmptyLines,
    ...(packageName ? { packageName } : {}),
  };
```

- [ ] **Step 2: Verify structure extraction still runs**

Run:

```bash
cd /Users/example/understand-code
node skills/understand/extract-structure.mjs
```

Expected result: it prints the usage line and exits non-zero because input/output arguments are required. That verifies the script still parses.

## Task 5: Update Graph Assembly Instructions

**Files:**
- Modify: `skills/understand/SKILL.md`

- [ ] **Step 1: Add call resolver to assembly guidance**

In the graph assembly phase where extracted structure records are converted to nodes and edges, add an explicit step:

```md
After all file/function/class nodes and import edges are assembled, build call resolver input from the extracted structure records:

- `path` from each structure record.
- `packageName` from each Go structure record when present.
- `imports` from each structure record after import-map resolution has converted import sources to project-relative file paths.
- `functions` from each structure record.
- `callGraph` from each structure record.

Then call `resolveCalls()` from `@understand-code/core`. For each `ResolvedCall`, call `GraphBuilder.addCallEdge(callerFile, callerFunc, calleeFile, calleeFunc)`. Add resolver diagnostics to the final summary:

- `resolvedCalls`: number of calls converted to edges.
- `unresolvedCalls`: number of raw calls that were omitted because they could not be mapped to a unique function node.
```

- [ ] **Step 2: Add validation criteria**

Add validation criteria:

```md
The final graph review must include `calls` in the edge type count whenever resolved calls are present. A missing `calls` count is acceptable only when `resolvedCalls` is zero.
```

## Task 6: Add Builder Regression Coverage

**Files:**
- Modify: `packages/core/src/analyzer/graph-builder.test.ts`

- [ ] **Step 1: Add duplicate call edge regression test**

Add:

```ts
it("deduplicates function call edges", () => {
  const builder = new GraphBuilder("test-project", "abc123");
  builder.addCallEdge("src/a.go", "Build", "src/b.go", "Load");
  builder.addCallEdge("src/a.go", "Build", "src/b.go", "Load");

  const graph = builder.build();
  const calls = graph.edges.filter((edge) => edge.type === "calls");

  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    source: "function:src/a.go:Build",
    target: "function:src/b.go:Load",
    direction: "forward",
    weight: 0.8,
  });
});
```

- [ ] **Step 2: Run core analyzer tests**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-code/core test -- src/analyzer/call-resolver.test.ts src/analyzer/graph-builder.test.ts
```

Expected result: tests pass.

## Task 7: End-to-End Verification

**Files:**
- No new files.

- [ ] **Step 1: Build core and dashboard**

Run:

```bash
cd /Users/example/understand-code
pnpm --filter @understand-code/core build
pnpm --filter @understand-code/dashboard build
```

Expected result: both builds pass.

- [ ] **Step 2: Generate a graph for a small Go fixture**

Use a project with two Go files where `a.go` calls a function in `b.go`. Run `/understand` from that project using this local plugin copy.

Expected result: `.understand-code/knowledge-graph.json` includes at least one edge:

```json
{
  "type": "calls",
  "source": "function:src/a.go:Build",
  "target": "function:src/b.go:Load"
}
```

- [ ] **Step 3: Verify Phase 1 consumes calls edges**

Open the dashboard for the same graph, drill into `a.go`, select `Build`, and confirm the right panel shows `Function calls` instead of `Estimated from file imports`.

## Acceptance Criteria

- The extractor output carries `packageName` for Go files.
- `resolveCalls()` maps same-file and imported package calls to unique function nodes.
- Ambiguous or unresolved calls are omitted and counted, not guessed.
- Final graphs include `calls` edges when resolvable calls exist.
- Phase 1 function impact switches from estimated imports to exact calls on graphs that contain `calls` edges.
- `pnpm --filter @understand-code/core build` passes.
- `pnpm --filter @understand-code/core test -- src/analyzer/call-resolver.test.ts src/analyzer/graph-builder.test.ts` passes.
