import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  GraphBuilder,
  PluginRegistry,
  TreeSitterPlugin,
  buildKnowledgeArtifacts,
  contentHash,
  createIgnoreFilter,
  extractFileFingerprint,
  generateKnowledgeBase,
  type FingerprintStore,
  type GeneratedDocument,
  type KnowledgeGraph,
  type StructuralAnalysis,
} from "@understand-code/core";
import { type RepositorySnapshotV1 } from "@understand-code/contracts";
import {
  isSensitiveRepositoryPath,
  readStableRepositoryFile,
} from "@understand-code/repository-state";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const SKIP_DIRECTORIES = new Set([
  ".git",
  ".understand-code",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".cache",
  ".turbo",
  "target",
  "vendor",
  "venv",
  ".venv",
  "__pycache__",
]);
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2",
  ".ttf", ".eot", ".mp3", ".mp4", ".pdf", ".zip", ".tar", ".gz",
]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

export class RepositoryIndexError extends Error {
  readonly code = "repository_index_failed" as const;

  constructor(message: string) {
    super(message);
    this.name = "RepositoryIndexError";
  }
}

interface SourceFile {
  readonly relativePath: string;
  readonly content: string;
}

export interface BuildRepositoryIndexInput {
  readonly canonicalRoot: string;
  readonly snapshot: RepositorySnapshotV1;
}

export interface BuildRepositoryIndexResult {
  readonly graph: KnowledgeGraph;
  readonly graphDigest: `sha256:${string}`;
  readonly analyzedFiles: number;
  readonly generatedAt: string;
}

function digest(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

async function collectSourceFiles(root: string): Promise<SourceFile[]> {
  const ignore = createIgnoreFilter(root);
  const files: SourceFile[] = [];
  const visit = async (directory: string, relativeDirectory: string): Promise<void> => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory === ""
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      if (isSensitiveRepositoryPath(relativePath)) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name) || ignore.isIgnored(`${relativePath}/`)) continue;
        await visit(path.join(directory, entry.name), relativePath);
        continue;
      }
      if (ignore.isIgnored(relativePath) || ignore.isIgnored(`${relativePath}/`)) continue;
      if (entry.isSymbolicLink()) {
        // Do not follow links during analysis. A link can change between lstat
        // and read and would turn the indexer into an arbitrary file reader.
        throw new RepositoryIndexError(`symlink repository paths are not analyzable: ${relativePath}`);
      }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (BINARY_EXTENSIONS.has(extension)) continue;
      const absolutePath = path.join(root, relativePath);
      const stat = await fs.lstat(absolutePath);
      if (stat.size > MAX_SOURCE_BYTES) continue;
      let content: string;
      try {
        content = (await readStableRepositoryFile(root, relativePath, MAX_SOURCE_BYTES)).toString("utf8");
      } catch {
        throw new RepositoryIndexError(`repository source changed or escaped during read: ${relativePath}`);
      }
      if (content.includes("\u0000")) continue;
      files.push({ relativePath, content });
    }
  };
  await visit(root, "");
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function lineRange(content: string): [number, number] {
  return [1, Math.max(1, content.split(/\r?\n/u).length)];
}

function sourceExcerpt(content: string): string {
  return content.length <= 800 ? content : `${content.slice(0, 800)}\n…`;
}

/**
 * The single-file Alpha bundle intentionally does not ship Tree-sitter WASM.
 * Keep a deliberately small, fail-safe structural fallback for ordinary
 * top-level TypeScript/JavaScript function and class declarations so a cold
 * install can retain stable Graph symbol identities. Complex or ambiguous
 * syntax is omitted instead of being guessed.
 */
function conservativeTypeScriptAnalysis(content: string): StructuralAnalysis | null {
  const masked = maskTypeScriptStructure(content);
  const lines = masked.split(/\r?\n/u);
  const functions: StructuralAnalysis["functions"] = [];
  const classes: StructuralAnalysis["classes"] = [];
  let outerDepth = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (outerDepth === 0) {
      const functionMatch = line.match(
        /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*)\b[^;{]*\{/u,
      );
      const classMatch = line.match(
        /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*)\b[^;{]*\{/u,
      );
      const match = functionMatch ?? classMatch;
      if (match !== null) {
        const openingBrace = line.indexOf("{", match.index ?? 0);
        const endLine = declarationEndLine(lines, index, openingBrace);
        if (endLine !== undefined) {
          const record = {
            name: match[1]!,
            lineRange: [index + 1, endLine + 1] as [number, number],
          };
          if (functionMatch !== null) {
            functions.push({ ...record, params: [] });
          } else {
            classes.push({ ...record, methods: [], properties: [] });
          }
        }
      }
    }
    outerDepth += braceDelta(line);
    if (outerDepth < 0) return null;
  }
  if (outerDepth !== 0) return null;

  const uniqueFunctions = uniqueDeclarations(functions);
  const uniqueClasses = uniqueDeclarations(classes);
  if (uniqueFunctions.length === 0 && uniqueClasses.length === 0) return null;
  return {
    functions: uniqueFunctions,
    classes: uniqueClasses,
    imports: [],
    exports: [],
  };
}

function uniqueDeclarations<T extends { readonly name: string }>(values: readonly T[]): T[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value.name, (counts.get(value.name) ?? 0) + 1);
  return values.filter((value) => counts.get(value.name) === 1);
}

function declarationEndLine(
  lines: readonly string[],
  startLine: number,
  openingBrace: number,
): number | undefined {
  if (openingBrace < 0) return undefined;
  let depth = 0;
  for (let lineIndex = startLine; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    const slice = lineIndex === startLine ? line.slice(openingBrace) : line;
    depth += braceDelta(slice);
    if (depth === 0) return lineIndex;
    if (depth < 0) return undefined;
  }
  return undefined;
}

function braceDelta(value: string): number {
  let result = 0;
  for (const character of value) {
    if (character === "{") result += 1;
    if (character === "}") result -= 1;
  }
  return result;
}

function maskTypeScriptStructure(source: string): string {
  type State = "code" | "line_comment" | "block_comment" | "single" | "double" | "template" | "regex";
  let state: State = "code";
  let escaped = false;
  let regexCharacterClass = false;
  let result = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    const next = source[index + 1];
    const newline = character === "\n" || character === "\r";
    if (state === "line_comment") {
      result += newline ? character : " ";
      if (newline) state = "code";
      continue;
    }
    if (state === "block_comment") {
      if (character === "*" && next === "/") {
        result += "  ";
        index += 1;
        state = "code";
      } else {
        result += newline ? character : " ";
      }
      continue;
    }
    if (state === "regex") {
      result += newline ? character : " ";
      if (newline) {
        state = "code";
        escaped = false;
        regexCharacterClass = false;
      } else if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "[") {
        regexCharacterClass = true;
      } else if (character === "]") {
        regexCharacterClass = false;
      } else if (character === "/" && !regexCharacterClass) {
        state = "code";
      }
      continue;
    }
    if (state === "single" || state === "double" || state === "template") {
      const terminator = state === "single" ? "'" : state === "double" ? "\"" : "`";
      result += newline ? character : " ";
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === terminator) state = "code";
      continue;
    }
    if (character === "/" && next === "/") {
      result += "  ";
      index += 1;
      state = "line_comment";
    } else if (character === "/" && next === "*") {
      result += "  ";
      index += 1;
      state = "block_comment";
    } else if (character === "/" && isLikelyTypeScriptRegex(source, index)) {
      result += " ";
      state = "regex";
      escaped = false;
      regexCharacterClass = false;
    } else if (character === "'") {
      result += " ";
      state = "single";
    } else if (character === "\"") {
      result += " ";
      state = "double";
    } else if (character === "`") {
      result += " ";
      state = "template";
    } else {
      result += character;
    }
  }
  return result;
}

function isLikelyTypeScriptRegex(source: string, slashIndex: number): boolean {
  let cursor = slashIndex - 1;
  while (cursor >= 0 && /\s/u.test(source[cursor]!)) cursor -= 1;
  if (cursor < 0) return true;
  if (/[=([{,:;!?&|^~<>%*+\-]/u.test(source[cursor]!)) return true;
  return /(?:^|[^\p{ID_Continue}])(?:return|case|throw|yield|await|typeof|instanceof|in|of)\s*$/u
    .test(source.slice(0, slashIndex));
}

function resolveImportPath(relativePath: string, source: string, known: ReadonlySet<string>): string | undefined {
  if (!source.startsWith(".")) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), source));
  const candidates = [base, ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].map((ext) => `${base}${ext}`),
    ...[".ts", ".tsx", ".js", ".jsx"].map((ext) => `${base}/index${ext}`)];
  return candidates.find((candidate) => known.has(candidate));
}

function fallbackDocument(
  existing: GeneratedDocument | undefined,
  input: { readonly id: string; readonly path: string; readonly title: string; readonly stage: "purpose" | "evidence"; readonly nodeId: string; readonly filePath: string; readonly excerpt: string; readonly lineRange: [number, number] },
): GeneratedDocument {
  return {
    ...(existing ?? {
      representedEdgeIds: [],
      reason: "repository-indexer-fallback",
      symbolAnchors: [],
      searchTerms: [input.title, input.filePath],
      category: "overview" as const,
      role: "featured" as const,
      directNodeIds: [input.nodeId],
      contextNodeIds: [],
    }),
    id: input.id,
    path: input.path,
    title: input.title,
    summary: `${input.title}（由本地源码索引生成）`,
    category: input.stage === "purpose" ? "overview" : "module",
    role: "featured",
    directNodeIds: [input.nodeId],
    contextNodeIds: [],
    route: { order: input.stage === "purpose" ? 0 : 1, stage: input.stage },
    content: input.stage === "purpose"
      ? `# ${input.title}\n\n## 项目边界\n\n本页由本地源码扫描生成，描述当前绑定仓库中的真实文件与可追踪入口。\n\n## 入口证据\n\n${input.filePath} 是当前索引发现的入口文件；后续页面和搜索结果均绑定同一源码快照。\n\n## 维护提示\n\n源码变化后重新运行 refresh_index mode=full，以重新生成图谱和知识索引。`
      : `# ${input.title}\n\n## 文件职责\n\n${input.filePath} 已纳入本次源码图谱。\n\n## 源码证据\n\n\`${input.filePath}\` 的实际内容已被安全读取并绑定到当前快照。`,
    sourceEvidence: [{
      filePath: input.filePath,
      lineRange: input.lineRange,
      nodeId: input.nodeId,
      excerpt: input.excerpt,
      claim: `${input.filePath} 是当前仓库中的真实源码节点。`,
    }],
    quality: "generated",
    generationStatus: "complete",
    qualityIssues: [],
  };
}

function ensureRouteDocuments(
  documents: GeneratedDocument[],
  graph: KnowledgeGraph,
  sourceFiles: readonly SourceFile[],
): GeneratedDocument[] {
  const firstFile = graph.nodes.find((node) => node.type === "file" && node.filePath !== undefined);
  if (firstFile?.filePath === undefined) {
    throw new RepositoryIndexError("repository contains no analyzable source files");
  }
  const source = sourceFiles.find((file) => file.relativePath === firstFile.filePath);
  if (source === undefined) throw new RepositoryIndexError(`indexed source disappeared: ${firstFile.filePath}`);
  const anchor = graph.nodes.find((node) => node.filePath === firstFile.filePath && node.type !== "file") ?? firstFile;
  const byPath = new Map(documents.map((document) => [document.path, document]));
  const overview = byPath.get("项目总览.md");
  const entry = byPath.get("源码入口.md");
  const usableRouteDocument = (document: GeneratedDocument | undefined): boolean =>
    document !== undefined
    && document.generationStatus === "complete"
    && document.quality !== "failed"
    && document.route !== undefined
    && document.directNodeIds.length > 0
    && document.sourceEvidence.length > 0;
  if (!usableRouteDocument(overview)) {
    byPath.set("项目总览.md", fallbackDocument(overview, {
      id: overview?.id ?? "page:%E9%A1%B9%E7%9B%AE%E6%80%BB%E8%A7%88.md",
      path: "项目总览.md",
      title: "项目总览",
      stage: "purpose",
      nodeId: anchor.id,
      filePath: firstFile.filePath,
      excerpt: sourceExcerpt(source.content),
      lineRange: lineRange(source.content),
    }));
  }
  if (!usableRouteDocument(entry)) {
    byPath.set("源码入口.md", fallbackDocument(entry, {
      id: entry?.id ?? "page:%E6%BA%90%E7%A0%81%E5%85%A5%E5%8F%A3.md",
      path: "源码入口.md",
      title: "源码入口",
      stage: "evidence",
      nodeId: firstFile.id,
      filePath: firstFile.filePath,
      excerpt: sourceExcerpt(source.content),
      lineRange: lineRange(source.content),
    }));
  }
  return [...byPath.values()];
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, filePath);
}

async function ensureDirectoryChain(root: string, directory: string): Promise<void> {
  const relative = path.relative(root, directory);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new RepositoryIndexError(`generated artifact path escapes managed root: ${directory}`);
  }
  let current = root;
  for (const segment of relative === "" ? [] : relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new RepositoryIndexError(`managed artifact parent is not a directory: ${current}`);
      }
    } catch (error) {
      if (error instanceof RepositoryIndexError) throw error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await fs.mkdir(current);
    }
  }
}

async function atomicWriteText(filePath: string, value: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporary, value.endsWith("\n") ? value : `${value}\n`, "utf8");
  await fs.rename(temporary, filePath);
}

export async function buildRepositoryIndex(
  input: BuildRepositoryIndexInput,
): Promise<BuildRepositoryIndexResult> {
  const { canonicalRoot, snapshot } = input;
  const managedRoot = path.join(canonicalRoot, ".understand-code");
  try {
    const managedStat = await fs.lstat(managedRoot);
    if (managedStat.isSymbolicLink()) throw new RepositoryIndexError("managed artifact directory must not be a symlink");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const sourceFiles = await collectSourceFiles(canonicalRoot);
  const plugin = new TreeSitterPlugin();
  const registry = new PluginRegistry();
  // WASM grammars are an optional local acceleration. The packed CLI does not
  // ship the runtime WASM beside its single-file bundle, so do not initialize
  // it implicitly (Emscripten would write an error to stderr); callers that
  // deliberately provision grammars can opt in without changing the file
  // level/index artifact contract.
  if (process.env.UNDERSTAND_CODE_ENABLE_TREE_SITTER === "1") {
    try {
      await plugin.init();
      registry.register(plugin);
    } catch {
      // File nodes and deterministic Wiki pages remain valid without a parser.
    }
  }
  const projectName = path.basename(canonicalRoot) || "repository";
  const generatedAt = snapshot.createdAt;
  const builder = new GraphBuilder(projectName, snapshot.headCommit ?? "unknown");
  const analyses = new Map<string, ReturnType<PluginRegistry["analyzeFile"]>>();
  for (const source of sourceFiles) {
    const analysis = CODE_EXTENSIONS.has(path.extname(source.relativePath).toLowerCase())
      ? registry.analyzeFile(source.relativePath, source.content)
        ?? conservativeTypeScriptAnalysis(source.content)
      : null;
    analyses.set(source.relativePath, analysis);
    const summary = `${source.relativePath} 的源码节点（${source.content.split(/\r?\n/u).length} 行）`;
    if (analysis !== null) {
      const summaries = Object.fromEntries([
        ...analysis.functions.map((fn) => [fn.name, `${fn.name} 的本地实现`]),
        ...analysis.classes.map((cls) => [cls.name, `${cls.name} 的本地类型`]),
      ]);
      builder.addFileWithAnalysis(source.relativePath, analysis, {
        summary,
        tags: [path.extname(source.relativePath).slice(1) || "source"],
        complexity: "simple",
        summaries,
        fileSummary: summary,
      });
    } else {
      builder.addFile(source.relativePath, {
        summary,
        tags: [path.extname(source.relativePath).slice(1) || "source"],
        complexity: "simple",
      });
    }
  }
  const known = new Set(sourceFiles.map((source) => source.relativePath));
  for (const source of sourceFiles) {
    const analysis = analyses.get(source.relativePath);
    for (const imported of analysis?.imports ?? []) {
      const target = resolveImportPath(source.relativePath, imported.source, known);
      if (target !== undefined) builder.addImportEdge(source.relativePath, target);
    }
  }
  const graph = builder.build();
  graph.project.analyzedAt = generatedAt;
  const graphDigest = digest(JSON.stringify(graph));
  const sourceMap = Object.fromEntries(sourceFiles.map((source) => [source.relativePath, source.content]));
  const knowledge = generateKnowledgeBase(graph, {
    projectRoot: canonicalRoot,
    sourceFiles: sourceMap,
    currentGitCommitHash: snapshot.headCommit,
    outputLanguage: "zh-CN",
    generationMode: "writer",
    deterministicOnly: false,
  });
  const documents = ensureRouteDocuments(knowledge.documents, graph, sourceFiles);
  const graphNodes = graph.nodes.map((node) => ({ id: node.id, type: node.type, name: node.name, ...(node.filePath === undefined ? {} : { filePath: node.filePath }) }));
  const artifacts = buildKnowledgeArtifacts({
    projectName,
    generatedAt,
    outputLanguage: "zh-CN",
    generationMode: "writer",
    graphDigest,
    gitCommitHash: snapshot.headCommit,
    sourceRootIdentity: snapshot.rootIdentity,
    sourceRead: {
      covered: sourceFiles.length,
      total: sourceFiles.length,
      missingIds: [],
    },
    requiredRouteStages: ["purpose", "evidence"],
    businessTerms: [],
    nodes: graphNodes,
    referenceFileNodeIds: graph.nodes
      .filter((node) => ["file", "config", "schema", "document"].includes(node.type) && node.filePath !== undefined)
      .map((node) => node.id),
    documents,
    warnings: [],
    errors: [],
  });
  if (artifacts.wikiIndex.mainReadiness.status !== "ready") {
    throw new RepositoryIndexError(`knowledge index is not ready: ${artifacts.wikiIndex.mainReadiness.reasons.join("; ")}`);
  }
  const fingerprintFiles: FingerprintStore["files"] = {};
  for (const source of sourceFiles) {
    const analysis = analyses.get(source.relativePath);
    fingerprintFiles[source.relativePath] = analysis === null || analysis === undefined
      ? {
          filePath: source.relativePath,
          contentHash: contentHash(source.content),
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          totalLines: source.content.split("\n").length,
          hasStructuralAnalysis: false,
        }
      : extractFileFingerprint(source.relativePath, source.content, analysis);
  }
  const fingerprints: FingerprintStore = {
    version: "1.0.0",
    gitCommitHash: snapshot.headCommit ?? "unknown",
    generatedAt,
    files: fingerprintFiles,
  };
  await ensureDirectoryChain(canonicalRoot, managedRoot);
  const knowledgeBaseRoot = path.join(managedRoot, "knowledge-base");
  const traceRoot = path.join(knowledgeBaseRoot, ".trace");
  await ensureDirectoryChain(managedRoot, knowledgeBaseRoot);
  await ensureDirectoryChain(knowledgeBaseRoot, traceRoot);
  await atomicWriteJson(path.join(managedRoot, "knowledge-graph.json"), graph);
  await atomicWriteJson(path.join(managedRoot, "meta.json"), {
    lastAnalyzedAt: generatedAt,
    gitCommitHash: snapshot.headCommit ?? "unknown",
    version: graph.version,
    analyzedFiles: sourceFiles.length,
  });
  await atomicWriteJson(path.join(managedRoot, "fingerprints.json"), fingerprints);
  for (const document of documents) {
    const relativeDocument = document.path.replaceAll("\\", "/");
    if (relativeDocument.startsWith("/") || relativeDocument.split("/").some((segment) => segment === ".." || segment === "")) {
      throw new RepositoryIndexError(`generated document path is unsafe: ${relativeDocument}`);
    }
    const documentPath = path.join(knowledgeBaseRoot, relativeDocument);
    await ensureDirectoryChain(knowledgeBaseRoot, path.dirname(documentPath));
    await atomicWriteText(documentPath, document.content);
  }
  await atomicWriteJson(path.join(knowledgeBaseRoot, "wiki-index.json"), artifacts.wikiIndex);
  await atomicWriteJson(path.join(knowledgeBaseRoot, "search-index.json"), artifacts.searchIndex);
  await atomicWriteJson(path.join(traceRoot, "document-traces.json"), artifacts.documentTraces);
  await atomicWriteJson(path.join(traceRoot, "generation-report.json"), artifacts.generationReport);
  return { graph, graphDigest, analyzedFiles: sourceFiles.length, generatedAt };
}
