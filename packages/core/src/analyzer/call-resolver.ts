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

export function resolveCalls(files: CallResolverFile[]): ResolveCallsResult {
  const calls: ResolvedCall[] = [];
  const unresolved: UnresolvedCall[] = [];
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const functionsByFile = new Map(files.map((file) => [file.path, new Set(file.functions.map((fn) => fn.name))]));

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
        const qualifier = parsed.qualifier;
        const importedTargets = file.imports
          .filter((imp) => imp.specifiers.includes(qualifier) || filesByPath.get(imp.source)?.packageName === qualifier)
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
