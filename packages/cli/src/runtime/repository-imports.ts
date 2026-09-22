import path from "node:path";

export interface RepositoryImportSourceFile {
  readonly relativePath: string;
  readonly content: string;
}

type GoModule = { readonly directory: string; readonly modulePath?: string };

const TS_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"] as const;
const TS_INDEX_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

function normalizeRelative(value: string): string {
  return path.posix.normalize(value.replaceAll("\\", "/")).replace(/^\.\//u, "");
}

function parseModuleLine(line: string): { state: "none" | "valid" | "invalid"; value?: string } {
  let text = line.trim();
  if (text === "" || text.startsWith("//")) return { state: "none" };
  if (!/^module(?:[ \t]|$)/u.test(text)) return { state: "none" };
  text = text.slice("module".length).trimStart();
  if (text === "") return { state: "invalid" };

  let token: string;
  let rest: string;
  if (text.startsWith('"')) {
    let end = -1;
    let escaped = false;
    for (let index = 1; index < text.length; index += 1) {
      const char = text[index];
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        end = index;
        break;
      }
    }
    if (end < 0) return { state: "invalid" };
    try {
      token = JSON.parse(text.slice(0, end + 1)) as string;
    } catch {
      return { state: "invalid" };
    }
    rest = text.slice(end + 1).trimStart();
  } else {
    const match = /^([^ \t\r\n]+)([\s\S]*)$/u.exec(text);
    if (!match) return { state: "invalid" };
    token = match[1];
    rest = match[2].trimStart();
  }
  if (rest !== "" && !rest.startsWith("//")) return { state: "invalid" };
  // Keep this parser conservative: only a single non-empty, slash-separated
  // module path is useful for repository-local resolution.
  if (!token || /[\u0000-\u001f\u007f\s]/u.test(token) || token.includes("\\") ||
    !/^[A-Za-z0-9][A-Za-z0-9._+~-]*(?:\/[A-Za-z0-9][A-Za-z0-9._+~-]*)*$/u.test(token) ||
    token.split("/").some((part) => part === "." || part === "..")) {
    return { state: "invalid" };
  }
  return { state: "valid", value: token };
}

function parseGoModule(content: string): string | undefined {
  let found: string | undefined;
  let invalid = false;
  for (const line of content.split(/\r?\n/u)) {
    const result = parseModuleLine(line);
    if (result.state === "invalid") invalid = true;
    if (result.state === "valid") {
      if (found !== undefined) invalid = true;
      found = result.value;
    }
  }
  return invalid ? undefined : found;
}

function nearestBoundary(directory: string, boundaries: ReadonlySet<string>): string | undefined {
  let current = normalizeRelative(directory);
  if (current === ".") current = "";
  for (;;) {
    if (boundaries.has(current)) return current;
    if (current === "") return undefined;
    current = path.posix.dirname(current);
    if (current === ".") current = "";
  }
}

function resolveTsImport(relativePath: string, source: string, known: ReadonlySet<string>): string | undefined {
  if (source !== "." && source !== ".." && !source.startsWith("./") && !source.startsWith("../")) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), source));
  const counterparts = base.endsWith(".js") ? [base.slice(0, -3) + ".ts", base.slice(0, -3) + ".tsx"]
    : base.endsWith(".jsx") ? [base.slice(0, -4) + ".tsx"]
      : base.endsWith(".mjs") ? [base.slice(0, -4) + ".mts"]
        : base.endsWith(".cjs") ? [base.slice(0, -4) + ".cts"] : [];
  const candidates = [base, ...counterparts,
    ...TS_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...TS_INDEX_EXTENSIONS.map((extension) => `${base}/index${extension}`)];
  return candidates.find((candidate) => known.has(candidate));
}

/** Parse JSONC without evaluating configuration or loading anything outside the source inventory. */
function configObject(content: string): Record<string, any> | undefined {
  try {
    let cleaned = "";
    let quoted = false;
    for (let index = 0; index < content.length; index += 1) {
      const char = content[index];
      if (quoted) {
        cleaned += char;
        if (char === "\\") cleaned += content[++index] ?? "";
        else if (char === '"') quoted = false;
      } else if (char === '"') { quoted = true; cleaned += char; }
      else if (char === "/" && content[index + 1] === "/") {
        while (index + 1 < content.length && content[index + 1] !== "\n") index += 1;
        cleaned += " ";
      } else if (char === "/" && content[index + 1] === "*") {
        const end = content.indexOf("*/", index + 2);
        if (end < 0) return undefined;
        index = end + 1; cleaned += " ";
      } else cleaned += char;
    }
    let json = "";
    quoted = false;
    for (let index = 0; index < cleaned.length; index += 1) {
      const char = cleaned[index];
      if (quoted) {
        json += char;
        if (char === "\\") json += cleaned[++index] ?? "";
        else if (char === '"') quoted = false;
      } else if (char === '"') { quoted = true; json += char; }
      else if (char !== "," || !/^\s*[}\]]/u.test(cleaned.slice(index + 1))) json += char;
    }
    const parsed: unknown = JSON.parse(json);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, any> : undefined;
  } catch { return undefined; }
}

function withinRepository(value: string): boolean {
  return value !== ".." && !value.startsWith("../") && !path.posix.isAbsolute(value) && !value.includes("\\");
}

function createConfiguredTsResolver(files: readonly RepositoryImportSourceFile[], known: ReadonlySet<string>) {
  const contents = new Map(files.map((file) => [file.relativePath, file.content]));
  type Config = { baseUrl?: string; paths?: Record<string, unknown>; pathsBase: string; rootDir?: string; outDir?: string };
  const configCache = new Map<string, Config | undefined>();
  const configFor = (configPath: string, seen = new Set<string>()): Config | undefined => {
    if (configCache.has(configPath)) return configCache.get(configPath);
    if (seen.has(configPath) || seen.size >= 16) return undefined;
    configCache.set(configPath, undefined);
    const raw = contents.get(configPath);
    const value = raw === undefined ? undefined : configObject(raw);
    if (!value) return undefined;
    const directory = path.posix.dirname(configPath);
    let inherited: Config | undefined;
    if (value.extends !== undefined) {
      if (typeof value.extends !== "string" || !value.extends.startsWith(".")) return undefined;
      const base = path.posix.normalize(path.posix.join(directory, value.extends));
      const target = [base, `${base}.json`, `${base}/tsconfig.json`].find((item) => contents.has(item));
      if (!target || !withinRepository(target)) return undefined;
      inherited = configFor(target, new Set(seen).add(configPath));
      if (!inherited) return undefined;
    }
    const options = value.compilerOptions ?? {};
    if (!options || typeof options !== "object" || Array.isArray(options)) return undefined;
    const resolveOption = (name: string, previous?: string): string | undefined => {
      if (options[name] === undefined) return previous;
      if (typeof options[name] !== "string") return undefined;
      const resolved = path.posix.normalize(path.posix.join(directory, options[name]));
      return withinRepository(resolved) ? resolved : undefined;
    };
    for (const name of ["baseUrl", "rootDir", "outDir"]) {
      if (options[name] !== undefined && (typeof options[name] !== "string" || path.posix.isAbsolute(options[name]) ||
          !withinRepository(path.posix.normalize(path.posix.join(directory, options[name]))))) return undefined;
    }
    const baseUrl = resolveOption("baseUrl", inherited?.baseUrl);
    const ownPaths = options.paths;
    if (ownPaths !== undefined && (!ownPaths || typeof ownPaths !== "object" || Array.isArray(ownPaths))) return undefined;
    const result: Config = { baseUrl, paths: ownPaths ?? inherited?.paths,
      pathsBase: ownPaths === undefined ? inherited?.pathsBase ?? baseUrl ?? directory : baseUrl ?? directory,
      rootDir: resolveOption("rootDir", inherited?.rootDir), outDir: resolveOption("outDir", inherited?.outDir) };
    configCache.set(configPath, result);
    return result;
  };
  const configDirectories = new Set(files.filter((file) => /(?:^|\/)(?:tsconfig|jsconfig)\.json$/u.test(file.relativePath))
    .map((file) => path.posix.dirname(file.relativePath) === "." ? "" : path.posix.dirname(file.relativePath)));
  const nearestConfig = (fromPath: string) => {
    const directory = nearestBoundary(path.posix.dirname(fromPath), configDirectories);
    if (directory === undefined) return undefined;
    const prefix = directory ? `${directory}/` : "";
    return configFor(contents.has(`${prefix}tsconfig.json`) ? `${prefix}tsconfig.json` : `${prefix}jsconfig.json`);
  };
  const probe = (target: string) => withinRepository(target)
    ? resolveTsImport("__repository__.ts", `./${target}`, known) : undefined;
  const manifests = new Map<string, Record<string, any>>();
  const byName = new Map<string, string[]>();
  for (const file of files.filter((entry) => /(?:^|\/)package\.json$/u.test(entry.relativePath))) {
    const value = configObject(file.content);
    if (!value) continue;
    const directory = path.posix.dirname(file.relativePath) === "." ? "" : path.posix.dirname(file.relativePath);
    manifests.set(directory, value);
    if (typeof value.name === "string") byName.set(value.name, [...(byName.get(value.name) ?? []), directory]);
  }
  // Resolve only a single runtime export. Divergent conditional exports are
  // intentionally unresolved: a static source inventory does not select Node conditions.
  const manifestDirectories = new Set(manifests.keys());
  const exportTarget = (value: unknown, depth = 0): string | undefined => {
    if (depth > 16) return undefined;
    if (typeof value === "string") return value.startsWith("./") ? value : undefined;
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const targets = Object.entries(value).filter(([key]) => key !== "types")
      .map(([, entry]) => exportTarget(entry, depth + 1));
    return targets.length > 0 && targets.every((entry) => entry !== undefined && entry === targets[0]) ? targets[0] : undefined;
  };
  return (fromPath: string, source: string): string | undefined => {
    const config = nearestConfig(fromPath);
    const keys = Object.keys(config?.paths ?? {}).filter((key) => {
      const parts = key.split("*");
      return parts.length === 1 ? key === source : parts.length === 2 && source.startsWith(parts[0]) && source.endsWith(parts[1]) && source.length >= parts[0].length + parts[1].length;
    }).sort((a, b) => Number(b === source) - Number(a === source) || b.indexOf("*") - a.indexOf("*"));
    if (keys.length > 0) {
      const key = keys[0];
      const targets = config!.paths![key];
      if (!Array.isArray(targets) || !targets.every((entry) => typeof entry === "string")) return undefined;
      const parts = key.split("*");
      const capture = parts.length === 1 ? "" : source.slice(parts[0].length, source.length - parts[1].length);
      for (const target of targets as string[]) {
        if (target.split("*").length > 2 || (parts.length === 1 && target.includes("*")) || path.posix.isAbsolute(target)) continue;
        const found = probe(path.posix.normalize(path.posix.join(config!.pathsBase, target.replace("*", capture))));
        if (found) return found;
      }
      return undefined;
    }
    if (config?.baseUrl !== undefined) {
      const found = probe(path.posix.normalize(path.posix.join(config.baseUrl, source)));
      if (found) return found;
    }
    const parts = source.split("/");
    const name = source.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    const targets = byName.get(name) ?? [];
    if (targets.length !== 1) return undefined;
    const importerDirectory = nearestBoundary(path.posix.dirname(fromPath), manifestDirectories);
    if (importerDirectory === undefined) return undefined;
    const importer = manifests.get(importerDirectory)!;
    const dependency = [importer.dependencies, importer.devDependencies, importer.peerDependencies, importer.optionalDependencies]
      .map((entries) => entries?.[name]).filter((value) => value !== undefined);
    if (importerDirectory !== targets[0] && (dependency.length === 0 || !dependency.every((value) => typeof value === "string" && value.startsWith("workspace:")))) return undefined;
    const targetDirectory = targets[0];
    const manifest = manifests.get(targetDirectory)!;
    const subpath = source.slice(name.length);
    const exportKey = subpath ? `.${subpath}` : ".";
    let target: string | undefined;
    if (manifest.exports !== undefined) {
      const exports = manifest.exports;
      target = typeof exports === "object" && exports !== null && !Array.isArray(exports) && Object.keys(exports).some((key) => key.startsWith("."))
        ? exportTarget(exports[exportKey]) : exportKey === "." ? exportTarget(exports) : undefined;
    } else if (!subpath) target = typeof manifest.main === "string" ? manifest.main : "./index.js";
    if (!target || path.posix.isAbsolute(target) || target.includes("\\") || target.split("/").includes("..")) return undefined;
    const targetPath = path.posix.normalize(path.posix.join(targetDirectory, target));
    const found = probe(targetPath);
    if (found) return found;
    // A declared rootDir/outDir mapping, not a guessed dist -> src convention.
    const targetConfig = configFor(path.posix.join(targetDirectory, "tsconfig.json"));
    if (targetConfig?.outDir && targetConfig.rootDir && targetPath.startsWith(`${targetConfig.outDir}/`)) {
      return probe(path.posix.join(targetConfig.rootDir, targetPath.slice(targetConfig.outDir.length + 1)));
    }
    return undefined;
  };
}

/** Build a deterministic, read-only import resolver for one source snapshot. */
export function createRepositoryImportResolverV1(
  sourceFiles: readonly RepositoryImportSourceFile[],
): (fromPath: string, importSource: string) => string[] {
  const files = sourceFiles.map((file) => ({ ...file, relativePath: normalizeRelative(file.relativePath) }));
  const known = new Set(files.map((file) => file.relativePath));
  const configuredTsImport = createConfiguredTsResolver(files, known);
  const goFilesByDirectory = new Map<string, string[]>();
  const moduleByDirectory = new Map<string, GoModule>();
  const boundaries = new Set<string>();

  for (const file of files) {
    const directory = path.posix.dirname(file.relativePath) === "." ? "" : path.posix.dirname(file.relativePath);
    if (file.relativePath.endsWith("/go.mod") || file.relativePath === "go.mod") {
      boundaries.add(directory);
      moduleByDirectory.set(directory, { directory, modulePath: parseGoModule(file.content) });
    }
    if (file.relativePath.endsWith(".go") && !file.relativePath.endsWith("_test.go") &&
        !/^[._]/u.test(path.posix.basename(file.relativePath))) {
      const list = goFilesByDirectory.get(directory) ?? [];
      list.push(file.relativePath);
      goFilesByDirectory.set(directory, list);
    }
  }
  for (const list of goFilesByDirectory.values()) list.sort();

  return (fromPath, importSource) => {
    const importer = normalizeRelative(fromPath);
    const source = importSource;
    if (!known.has(importer) || source !== source.trim() || path.posix.isAbsolute(source) || source.includes("\\")) return [];
    if (/\.(?:[cm]?[jt]s|[jt]sx)$/u.test(importer)) {
      const relativeTarget = source.startsWith(".") ? resolveTsImport(importer, source, known) : configuredTsImport(importer, source);
      return relativeTarget === undefined ? [] : [relativeTarget];
    }
    if (!importer.endsWith(".go") || source.startsWith(".")) return [];

    const importerDirectory = path.posix.dirname(importer) === "." ? "" : path.posix.dirname(importer);
    const importerModuleDirectory = nearestBoundary(importerDirectory, boundaries);
    if (importerModuleDirectory === undefined) return [];
    const importerModule = moduleByDirectory.get(importerModuleDirectory)?.modulePath;
    if (importerModule === undefined) return [];
    let remainder: string;
    if (source === importerModule) remainder = "";
    else if (source.startsWith(`${importerModule}/`)) remainder = source.slice(importerModule.length + 1);
    else return [];
    const segments = remainder === "" ? [] : remainder.split("/");
    if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return [];
    const targetDirectory = remainder === "" ? importerModuleDirectory
      : path.posix.join(importerModuleDirectory, ...segments);
    if (nearestBoundary(targetDirectory, boundaries) !== importerModuleDirectory) return [];
    return [...(goFilesByDirectory.get(targetDirectory) ?? [])];
  };
}
