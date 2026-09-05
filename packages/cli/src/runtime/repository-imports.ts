import path from "node:path";

export interface RepositoryImportSourceFile {
  readonly relativePath: string;
  readonly content: string;
}

type GoModule = { readonly directory: string; readonly modulePath?: string };

const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;
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

/** Build a deterministic, read-only import resolver for one source snapshot. */
export function createRepositoryImportResolverV1(
  sourceFiles: readonly RepositoryImportSourceFile[],
): (fromPath: string, importSource: string) => string[] {
  const files = sourceFiles.map((file) => ({ ...file, relativePath: normalizeRelative(file.relativePath) }));
  const known = new Set(files.map((file) => file.relativePath));
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
    if (!known.has(importer) || source !== source.trim()) return [];
    if (/\.(?:[cm]?[jt]s|[jt]sx)$/u.test(importer)) {
      const relativeTarget = resolveTsImport(importer, source, known);
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
