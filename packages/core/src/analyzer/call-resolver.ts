import type { CallGraphEntry, StructuralAnalysis } from "../types.js";

export interface CallResolverFile {
  path: string;
  packageName?: string;
  /** Repository directory plus AST package name; never a project-wide package label. */
  packageScope?: string;
  callableFunctions?: readonly string[];
  imports: Array<{
    source: string;
    specifiers: string[];
    lineNumber: number;
    /** Repository paths established by the inventory-bound import resolver. */
    resolvedPaths?: readonly string[];
  }>;
  functions: Array<{ name: string; startLine: number; endLine: number }>;
  callableExports?: StructuralAnalysis["callableExports"];
  callGraph: CallGraphEntry[];
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

/** Resolve only AST-established bindings. A unique project-wide name is not a binding. */
export function resolveCalls(files: CallResolverFile[]): ResolveCallsResult {
  const calls: ResolvedCall[] = [];
  const unresolved: UnresolvedCall[] = [];
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const functionsByFile = new Map<string, Map<string, CallResolverFile["functions"][number] | undefined>>();
  const packageFunctions = new Map<string, CallResolverFile[]>();
  for (const file of files) {
    const symbols = new Map<string, CallResolverFile["functions"][number] | undefined>();
    for (const fn of file.functions) symbols.set(fn.name, symbols.has(fn.name) ? undefined : fn);
    functionsByFile.set(file.path, symbols);
    if (file.packageScope && file.packageName && !/(?:^|\/)[._][^/]*\.go$/u.test(file.path)) {
      for (const name of new Set(file.callableFunctions ?? [])) {
        if (!symbols.get(name)) continue;
        const key = `${file.packageScope}\0${file.packageName}\0${name}`;
        const candidates = packageFunctions.get(key) ?? [];
        candidates.push(file);
        packageFunctions.set(key, candidates);
      }
    }
  }
  const uniqueFunction = (file: CallResolverFile, name: string) => functionsByFile.get(file.path)?.get(name);

  for (const file of files) {
    for (const entry of file.callGraph) {
      const caller = uniqueFunction(file, entry.caller);
      const binding = entry.binding;
      const candidates = new Map<string, { file: string; name: string }>();
      if (caller && !/(?:^|\/)[._][^/]*\.go$/u.test(file.path) && Number.isSafeInteger(entry.lineNumber) &&
          entry.lineNumber >= caller.startLine && entry.lineNumber <= caller.endLine) {
        if (binding?.kind === "local" && uniqueFunction(file, binding.name)) {
          candidates.set(`${file.path}\0${binding.name}`, { file: file.path, name: binding.name });
        } else if (binding?.kind === "package" && file.packageScope && file.packageName) {
          const key = `${file.packageScope}\0${file.packageName}\0${binding.name}`;
          for (const target of packageFunctions.get(key) ?? []) {
            if (!file.path.endsWith("_test.go") && target.path.endsWith("_test.go")) continue;
            candidates.set(`${target.path}\0${binding.name}`, { file: target.path, name: binding.name });
          }
        } else if (binding?.kind === "import") {
          for (const imported of file.imports.filter((item) => item.source === binding.source)) {
            const targets = (imported.resolvedPaths ?? []).map((targetPath) => filesByPath.get(targetPath));
            if (file.path.endsWith(".go")) {
              const packages = new Set(targets.map((target) => target?.packageName));
              if (packages.size !== 1 || packages.has(undefined) || packages.has("main")) continue;
            }
            for (const target of targets) {
              if (!target || (binding.packageName !== undefined && target.packageName !== binding.packageName)) continue;
              if (/\.(?:[cm]?[jt]s|[jt]sx)$/u.test(file.path) && !/\.(?:[cm]?[jt]s|[jt]sx)$/u.test(target.path)) continue;
              if (file.path.endsWith(".go") && !target.path.endsWith(".go")) continue;
              const exports = (target.callableExports ?? []).filter((item) => item.name === binding.name);
              if (exports.length !== 1 || !uniqueFunction(target, exports[0].localName)) continue;
              const name = exports[0].localName;
              candidates.set(`${target.path}\0${name}`, { file: target.path, name });
            }
          }
        }
      }
      if (candidates.size === 1) {
        const target = candidates.values().next().value!;
        calls.push({ callerFile: file.path, callerFunc: entry.caller,
          calleeFile: target.file, calleeFunc: target.name,
          confidence: binding!.kind === "local" ? "same-file" : binding!.kind === "package" ? "exact" : "imported-package",
          lineNumber: entry.lineNumber });
      } else {
        unresolved.push({ file: file.path, caller: entry.caller, callee: entry.callee,
          lineNumber: entry.lineNumber });
      }
    }
  }
  return { calls, unresolved };
}
