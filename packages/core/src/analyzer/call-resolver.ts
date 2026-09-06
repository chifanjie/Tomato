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
  /** Explicit names also include non-callable declarations that shadow star exports. */
  exportNames?: readonly string[];
  reExports?: Array<NonNullable<StructuralAnalysis["reExports"]>[number] & { resolvedPaths?: readonly string[] }>;
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

  type ExportTargets = { targets: Map<string, { file: string; name: string }>; uncertain: boolean };
  const resolveExport = (
    file: CallResolverFile, name: string, seen: ReadonlySet<string>, budget: { remaining: number },
  ): ExportTargets => {
    const result: ExportTargets = { targets: new Map(), uncertain: false };
    const key = `${file.path}\0${name}`;
    // A cyclic branch contributes no export. Bound both depth and branching work.
    if (seen.has(key)) return result;
    if (seen.size >= 64 || budget.remaining-- <= 0) return { ...result, uncertain: true };
    const next = new Set(seen).add(key);
    const local = (file.callableExports ?? []).filter((item) => item.name === name);
    const named = (file.reExports ?? []).filter((item) => item.name === name);
    if (local.length + named.length > 1) return { ...result, uncertain: true };
    if (local.length === 1) {
      if (!uniqueFunction(file, local[0].localName)) return { ...result, uncertain: true };
      const target = { file: file.path, name: local[0].localName };
      result.targets.set(`${target.file}\0${target.name}`, target);
      return result;
    }
    if (named.length === 0 && file.exportNames?.includes(name)) return { ...result, uncertain: true };
    const forwarded = named.length > 0 ? named
      : name === "default" ? [] : (file.reExports ?? []).filter((item) => item.name === "*");
    for (const item of forwarded) {
      const paths = item.resolvedPaths ?? [];
      if (paths.length !== 1 || (item.name !== "*" && item.importedName === "*")) {
        result.uncertain = true;
        continue;
      }
      const target = filesByPath.get(paths[0]);
      if (!target || !/\.(?:[cm]?[jt]s|[jt]sx)$/u.test(target.path)) {
        result.uncertain = true;
        continue;
      }
      const resolved = resolveExport(target, item.name === "*" ? name : item.importedName, next, budget);
      result.uncertain ||= resolved.uncertain;
      for (const [id, candidate] of resolved.targets) result.targets.set(id, candidate);
      if (budget.remaining <= 0) return { ...result, uncertain: true };
    }
    return result;
  };
  // Only cache complete top-level queries: recursive results depend on cycle context.
  const exportsByBinding = new Map<string, ExportTargets>();

  for (const file of files) {
    for (const entry of file.callGraph) {
      const caller = uniqueFunction(file, entry.caller);
      const binding = entry.binding;
      const candidates = new Map<string, { file: string; name: string }>();
      let uncertainExport = false;
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
              if (!file.path.endsWith(".go")) {
                const key = `${target.path}\0${binding.name}`;
                let resolved = exportsByBinding.get(key);
                if (!resolved) {
                  resolved = resolveExport(target, binding.name, new Set(), { remaining: 4096 });
                  exportsByBinding.set(key, resolved);
                }
                uncertainExport ||= resolved.uncertain;
                for (const [id, candidate] of resolved.targets) candidates.set(id, candidate);
                continue;
              }
              const exports = (target.callableExports ?? []).filter((item) => item.name === binding.name);
              if (exports.length !== 1 || !uniqueFunction(target, exports[0].localName)) continue;
              const name = exports[0].localName;
              candidates.set(`${target.path}\0${name}`, { file: target.path, name });
            }
          }
        }
      }
      if (candidates.size === 1 && !uncertainExport) {
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
