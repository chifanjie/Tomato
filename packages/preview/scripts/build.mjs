import { chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { copyCurrentNativeKernelPeerAssetV1 } from "../../cli/scripts/native-kernel-peer-asset.mjs";

const exec = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(packageRoot, "../..");
const dashboardRoot = path.resolve(packageRoot, "../dashboard");
const distRoot = path.join(packageRoot, "dist");

const SCRIPT_ELEMENT_PATTERN = /<script\b(?<attributes>[^>]*)>(?<body>[\s\S]*?)<\/script>/giu;
const SCRIPT_SOURCE_ATTRIBUTE_PATTERN = /(?:^|\s)src\s*=\s*(["'])(?<source>[^"']+)\1/giu;
const EXPECTED_FIRST_PAINT_THEME_BOOTSTRAP_SHA256 = "bb1806d60772d743f0dc88538ee45b10fe829a951db7a24b7131c1acdceb4e0d";

function scriptSourceAttributes(attributes) {
  return [...attributes.matchAll(SCRIPT_SOURCE_ATTRIBUTE_PATTERN)].map((match) => match.groups?.source);
}

function externalizeFirstPaintThemeBootstrap(index) {
  const scripts = [...index.matchAll(SCRIPT_ELEMENT_PATTERN)];
  const openingScriptCount = index.match(/<script\b/giu)?.length ?? 0;
  const closingScriptCount = index.match(/<\/script>/giu)?.length ?? 0;
  if (scripts.length !== openingScriptCount || scripts.length !== closingScriptCount) {
    throw new Error("Preview dashboard contains a malformed script element");
  }
  const inlineScripts = scripts.filter((match) => scriptSourceAttributes(match.groups?.attributes ?? "").length === 0);
  if (inlineScripts.length !== 1) {
    throw new Error(`Preview dashboard must contain exactly one inline first-paint bootstrap; found ${inlineScripts.length}`);
  }
  const [inline] = inlineScripts;
  const attributes = inline.groups?.attributes.trim() ?? "";
  const body = inline.groups?.body ?? "";
  if (attributes !== "" || !body.includes('localStorage.getItem("uc-theme")') || !body.includes("dataset.themePreset")) {
    throw new Error("Preview dashboard inline script is not the expected first-paint theme bootstrap");
  }
  const source = `${body.trim()}\n`;
  const digest = createHash("sha256").update(source).digest("hex");
  if (digest !== EXPECTED_FIRST_PAINT_THEME_BOOTSTRAP_SHA256) {
    throw new Error("Preview dashboard first-paint theme bootstrap differs from its reviewed source contract");
  }
  const fileName = `theme-bootstrap-${digest}.js`;
  const replacement = `<script src="/assets/${fileName}"></script>`;
  const start = inline.index;
  if (start === undefined) throw new Error("Preview dashboard bootstrap has no source position");
  return {
    index: `${index.slice(0, start)}${replacement}${index.slice(start + inline[0].length)}`,
    fileName,
    source,
  };
}

function assertExternalScriptOnly(index, expectedBootstrapFileName) {
  if (/\son[a-z]+\s*=/iu.test(index) || /\b(?:href|src)\s*=\s*(["'])javascript:/iu.test(index)) {
    throw new Error("Preview dashboard contains an inline event handler or JavaScript URL");
  }
  const scripts = [...index.matchAll(SCRIPT_ELEMENT_PATTERN)];
  const openingScriptCount = index.match(/<script\b/giu)?.length ?? 0;
  const closingScriptCount = index.match(/<\/script>/giu)?.length ?? 0;
  if (scripts.length === 0 || scripts.length !== openingScriptCount || scripts.length !== closingScriptCount) {
    throw new Error("Preview dashboard script elements failed post-build validation");
  }
  const sources = scripts.map((match) => {
    if ((match.groups?.body ?? "").trim() !== "") {
      throw new Error("Preview dashboard contains inline script after bootstrap extraction");
    }
    const attributes = match.groups?.attributes ?? "";
    const sourceMatches = scriptSourceAttributes(attributes);
    if (/\bon[a-z]+\s*=/iu.test(attributes)
      || sourceMatches.length !== 1
      || !/^\/assets\/[A-Za-z0-9_.-]+\.js$/u.test(sourceMatches[0] ?? "")) {
      throw new Error("Preview dashboard scripts must use same-origin /assets sources");
    }
    return sourceMatches[0];
  });
  const expectedSource = `/assets/${expectedBootstrapFileName}`;
  if (sources.filter((source) => source === expectedSource).length !== 1) {
    throw new Error("Preview dashboard does not reference exactly one extracted theme bootstrap");
  }
}

async function run(command, args, cwd = workspaceRoot) {
  await exec(command, args, { cwd, env: { ...process.env, CI: "true" }, maxBuffer: 32 * 1024 * 1024 });
}

const graph = {
  version: "1.0.0",
  project: {
    name: "Preview 示例项目",
    languages: ["TypeScript"],
    frameworks: ["Understand Code"],
    description: "一个可离线查看 Graph/Wiki/Evidence 的最小示例。",
    analyzedAt: "2026-08-12T00:00:00.000Z",
    gitCommitHash: "preview-fixture",
  },
  nodes: [
    { id: "file:src/app.ts", type: "file", name: "app.ts", filePath: "src/app.ts", summary: "应用入口。", tags: ["entry"], complexity: "simple" },
    { id: "function:src/app.ts:main", type: "function", name: "main", filePath: "src/app.ts", lineRange: [1, 4], summary: "启动应用。", tags: ["entry"], complexity: "simple" },
    { id: "module:knowledge", type: "module", name: "Knowledge Layer", summary: "Graph/Wiki/Evidence 知识层。", tags: ["knowledge"], complexity: "moderate" },
  ],
  edges: [
    { source: "file:src/app.ts", target: "function:src/app.ts:main", type: "contains", direction: "forward", weight: 1 },
    { source: "function:src/app.ts:main", target: "module:knowledge", type: "documents", direction: "forward", weight: 0.8 },
  ],
  layers: [
    { id: "layer:entry", name: "入口", description: "启动与入口。", nodeIds: ["file:src/app.ts", "function:src/app.ts:main"] },
    { id: "layer:knowledge", name: "知识层", description: "可验证的 Graph/Wiki/Evidence。", nodeIds: ["module:knowledge"] },
  ],
  tour: [
    { order: 0, title: "从入口开始", description: "先阅读 app.ts 的 main。", nodeIds: ["file:src/app.ts", "function:src/app.ts:main"] },
    { order: 1, title: "进入知识层", description: "查看 Graph 与 Wiki 的关联。", nodeIds: ["module:knowledge"] },
  ],
};

function buildWiki(demoGraphDigest) {
  return {
  version: 2,
  generatedAt: "2026-08-12T00:00:00.000Z",
  projectName: "Preview 示例项目",
  source: { outputLanguage: "zh-CN", generationMode: "preview", graphDigest: demoGraphDigest, gitCommitHash: "preview-fixture", sourceRootIdentity: "/preview-demo" },
  mainReadiness: { status: "ready", reasons: [], routePageIds: ["page:overview", "page:flow"] },
  referenceCoverage: {
    status: "complete",
    files: { covered: 1, total: 1, missingIds: [] },
    functions: { covered: 1, total: 1, missingIds: [] },
    types: { covered: 0, total: 0, missingIds: [] },
  },
  pages: [
    { id: "page:overview", title: "项目总览", summary: "了解 Preview 的 Graph/Wiki/Evidence 工作面。", markdownPath: "knowledge-base/项目总览.md", role: "featured", category: "overview", quality: "generated", generationStatus: "complete", directNodeIds: ["module:knowledge"], contextNodeIds: [], evidenceIds: ["evidence:knowledge"], searchTerms: ["项目", "Preview", "知识层"], route: { order: 0, stage: "purpose" } },
    { id: "page:flow", title: "阅读与验证流程", summary: "从入口到源码证据的最短路径。", markdownPath: "knowledge-base/阅读流程.md", role: "featured", category: "flow", quality: "generated", generationStatus: "complete", directNodeIds: ["function:src/app.ts:main"], contextNodeIds: [], evidenceIds: ["evidence:main"], searchTerms: ["流程", "main", "证据"], route: { order: 1, stage: "flow" } },
    { id: "page:file", title: "app.ts 文件参考", summary: "入口源码和行号证据。", markdownPath: "knowledge-base/参考/app.ts.md", role: "reference", category: "file", quality: "generated", generationStatus: "complete", directNodeIds: ["file:src/app.ts", "function:src/app.ts:main"], contextNodeIds: [], evidenceIds: ["evidence:app"], searchTerms: ["app.ts", "main" ] },
  ],
  nodeDocumentation: [
    { nodeId: "module:knowledge", relation: "direct", quality: "generated", evidenceHealth: "source-linked", generationStatus: "complete", referenceCoverage: "anchored", directPageIds: ["page:overview"], contextPageIds: [], evidenceIds: ["evidence:knowledge"], primaryPageId: "page:overview" },
    { nodeId: "function:src/app.ts:main", relation: "direct", quality: "generated", evidenceHealth: "source-linked", generationStatus: "complete", referenceCoverage: "anchored", directPageIds: ["page:flow", "page:file"], contextPageIds: [], evidenceIds: ["evidence:main", "evidence:app"], primaryPageId: "page:file", anchor: "main" },
    { nodeId: "file:src/app.ts", relation: "direct", quality: "generated", evidenceHealth: "source-linked", generationStatus: "complete", referenceCoverage: "anchored", directPageIds: ["page:file"], contextPageIds: [], evidenceIds: ["evidence:app"], primaryPageId: "page:file" },
  ],
  evidence: [
    { id: "evidence:knowledge", nodeIds: ["module:knowledge"], filePath: "src/app.ts", lineRange: [1, 4], excerpt: "// Graph/Wiki/Evidence knowledge layer", evidenceType: "documentation" },
    { id: "evidence:main", nodeIds: ["function:src/app.ts:main"], filePath: "src/app.ts", lineRange: [1, 4], excerpt: "export function main() { return 'ready'; }", evidenceType: "production" },
    { id: "evidence:app", nodeIds: ["file:src/app.ts", "function:src/app.ts:main"], filePath: "src/app.ts", lineRange: [1, 4], excerpt: "export function main() { return 'ready'; }", evidenceType: "production" },
  ],
  };
}

function buildSearch(wiki) {
  return {
  version: 2,
  generatedAt: wiki.generatedAt,
  records: [
    { id: "search:overview", kind: "page", title: "项目总览", summary: wiki.pages[0].summary, pageId: "page:overview", role: "featured", category: "overview", relation: "direct", terms: ["项目", "Preview"], businessTerms: ["知识层"] },
    { id: "search:flow", kind: "page", title: "阅读与验证流程", summary: wiki.pages[1].summary, pageId: "page:flow", role: "featured", category: "flow", relation: "direct", terms: ["流程", "证据"], businessTerms: [] },
    { id: "search:file", kind: "page", title: "app.ts 文件参考", summary: wiki.pages[2].summary, pageId: "page:file", role: "reference", category: "file", relation: "direct", terms: ["app.ts", "main"], businessTerms: [] },
    { id: "search:main", kind: "symbol", title: "main", summary: "启动应用。", pageId: "page:file", anchor: "main", nodeId: "function:src/app.ts:main", role: "reference", category: "file", relation: "direct", terms: ["main", "app.ts"], businessTerms: [], filePath: "src/app.ts" },
  ],
  };
}
const config = { autoUpdate: false, outputLanguage: "zh-CN" };

async function main() {
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });
  await run("pnpm", ["--filter", "@understand-code/durable-object-provider-contracts", "build"]);
  await run("pnpm", ["--filter", "@understand-code/durable-object-provider-runtime", "build"]);
  await run("pnpm", ["--filter", "@understand-code/contracts", "build"]);
  await run("pnpm", ["--filter", "@understand-code/repository-state", "build"]);
  await run("pnpm", ["--filter", "@understand-code/artifact-store", "build"]);
  await run("pnpm", ["--filter", "@understand-code/core", "build"]);
  await run("pnpm", ["--filter", "@understand-code/task-engine", "build"]);
  await run("pnpm", ["--filter", "@understand-code/cli", "build"]);
  await run("pnpm", ["exec", "vite", "build", "--config", path.join(dashboardRoot, "vite.config.preview.mjs")], dashboardRoot);
  await run("pnpm", ["exec", "vite", "build", "--config", path.join(packageRoot, "vite.config.contracts.mjs")], dashboardRoot);
  const { parseWikiIndexV2, parseWikiSearchIndexV2, validateGraph } = await import(path.join(distRoot, "contracts.mjs"));
  const graphResult = validateGraph(graph);
  if (!graphResult.success || graphResult.data === undefined || graphResult.issues.length > 0) throw new Error("Preview demo graph failed its production contract");
  const validatedGraph = graphResult.data;
  const demoGraphDigest = createHash("sha256").update(JSON.stringify(validatedGraph)).digest("hex");
  const wiki = buildWiki(demoGraphDigest);
  const search = buildSearch(wiki);
  if (!parseWikiIndexV2(wiki).ok || !parseWikiSearchIndexV2(search).ok) {
    throw new Error("Preview demo Wiki/Search failed its production V2 contract");
  }
  const meta = { lastAnalyzedAt: wiki.generatedAt, gitCommitHash: "preview-fixture", version: "1.0.0", analyzedFiles: 1, theme: { presetId: "technical-document" } };
  await cp(path.join(workspaceRoot, "packages/cli/dist/understand-code.mjs"), path.join(distRoot, "understand-code.mjs"));
  await chmod(path.join(distRoot, "understand-code.mjs"), 0o755);
  await copyCurrentNativeKernelPeerAssetV1({
    sourceNativeRoot: path.join(workspaceRoot, "packages/cli/dist/native"),
    destinationNativeRoot: path.join(distRoot, "native"),
  });
  await cp(path.join(packageRoot, "src/bin.mjs"), path.join(distRoot, "bin.mjs"));
  await cp(path.join(packageRoot, "src/server.mjs"), path.join(distRoot, "server.mjs"));
  const demoRoot = path.join(distRoot, "demo/.understand-code");
  await mkdir(path.join(demoRoot, "knowledge-base/参考"), { recursive: true });
  await writeFile(path.join(demoRoot, "knowledge-graph.json"), `${JSON.stringify(validatedGraph, null, 2)}\n`);
  await writeFile(path.join(demoRoot, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  await writeFile(path.join(demoRoot, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
  await writeFile(path.join(demoRoot, "knowledge-base/wiki-index.json"), `${JSON.stringify(wiki, null, 2)}\n`);
  await writeFile(path.join(demoRoot, "knowledge-base/search-index.json"), `${JSON.stringify(search, null, 2)}\n`);
  await writeFile(path.join(demoRoot, "knowledge-base/项目总览.md"), "# 项目总览\n\n这是一个可安装的 Graph/Wiki Preview。你可以从知识层入口开始阅读，并沿着证据回到源码。\n");
  await writeFile(path.join(demoRoot, "knowledge-base/阅读流程.md"), "# 阅读与验证流程\n\n1. 从推荐阅读开始。\n2. 打开 Graph 节点。\n3. 查看 Evidence rail 的文件与行号。\n4. 搜索 `main` 回到入口。\n");
  await mkdir(path.join(demoRoot, "knowledge-base/参考"), { recursive: true });
  await writeFile(path.join(demoRoot, "knowledge-base/参考/app.ts.md"), "# app.ts\n\n```ts\nexport function main() { return 'ready'; }\n```\n\nEvidence: `src/app.ts:1-4`.\n");
  // Keep one real persisted Task Brief in the packed demo so the Task-first
  // Dashboard route exercises the same read-only artifact projection as a
  // published worktree. The fixture is validated by the contracts package.
  const referenceFixtures = path.join(workspaceRoot, "packages/contracts/fixtures/v1/reference");
  const demoTaskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const demoTaskRoot = path.join(demoRoot, "tasks", demoTaskId);
  await mkdir(demoTaskRoot, { recursive: true });
  await cp(path.join(referenceFixtures, "task.json"), path.join(demoTaskRoot, "task.json"));
  await cp(path.join(referenceFixtures, "task-brief.json"), path.join(demoTaskRoot, "task-brief.json"));
  await cp(path.join(referenceFixtures, "change-check.json"), path.join(demoTaskRoot, "change-check.json"));
  await cp(path.join(referenceFixtures, "verification.json"), path.join(demoTaskRoot, "verification.json"));
  await cp(path.join(referenceFixtures, "repo-pulse.json"), path.join(demoRoot, "repo-pulse.json"));
  await mkdir(path.join(distRoot, "demo/src"), { recursive: true });
  await writeFile(path.join(distRoot, "demo/src/app.ts"), "// Graph/Wiki/Evidence knowledge layer\nexport function main() { return 'ready'; }\n");
  await writeFile(path.join(distRoot, "README.md"), await readFile(path.join(packageRoot, "README.md")));
  const indexPath = path.join(distRoot, "dashboard/index.html");
  const sanitizedIndex = (await readFile(indexPath, "utf8"))
    .replace(/\s*<link rel="preconnect"[^>]*>/gu, "")
    .replace(/\s*<link\s+href="https:\/\/fonts\.googleapis\.com[^>]*>/gu, "")
    .replace(/\s*<link\s+href="https:\/\/fonts\.gstatic\.com[^>]*>/gu, "");
  const bootstrap = externalizeFirstPaintThemeBootstrap(sanitizedIndex);
  const bootstrapPath = path.join(distRoot, "dashboard/assets", bootstrap.fileName);
  await writeFile(bootstrapPath, bootstrap.source);
  await writeFile(indexPath, bootstrap.index);
  const packedIndex = await readFile(indexPath, "utf8");
  const packedBootstrap = await readFile(bootstrapPath, "utf8");
  if (createHash("sha256").update(packedBootstrap).digest("hex") !== bootstrap.fileName.slice("theme-bootstrap-".length, -".js".length)) {
    throw new Error("Preview dashboard theme bootstrap content hash does not match its file name");
  }
  assertExternalScriptOnly(packedIndex, bootstrap.fileName);
  process.stdout.write(`built ${distRoot}\n`);
}

main().catch((error) => { console.error(error); process.exit(1); });
