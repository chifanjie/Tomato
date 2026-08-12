import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { closeSync, constants as fsConstants, existsSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseWikiIndexV2,
  parseWikiSearchIndexV2,
  validateGraph,
} from "../dist/contracts.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DASHBOARD_ROOT = existsSync(path.join(PACKAGE_ROOT, "dist/dashboard"))
  ? path.join(PACKAGE_ROOT, "dist/dashboard")
  : path.join(PACKAGE_ROOT, "dashboard");
const DEMO_ROOT = existsSync(path.join(PACKAGE_ROOT, "dist/demo"))
  ? path.join(PACKAGE_ROOT, "dist/demo")
  : path.join(PACKAGE_ROOT, "demo");
const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_KB_BYTES = 2 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024;
const SENSITIVE = /(^|[\\/])(?:\.env(?:\..*)?|\.npmrc|\.netrc|credentials?|secrets?|\.aws|\.ssh|id_rsa|.*\.(?:pem|key|p12|pfx))(?=$|[\\/\.])/iu;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function safeRelative(value) {
  if (!value || value.includes("\0")) return null;
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  const normalized = path.posix.normalize(decoded.replaceAll("\\", "/"));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/")) return null;
  if (SENSITIVE.test(normalized)) return null;
  return normalized;
}

function readContainedJson(root, relative, maxBytes = MAX_ARTIFACT_BYTES) {
  const bytes = readContained(root, relative, maxBytes);
  if (!bytes) return null;
  try { return JSON.parse(bytes.toString("utf8")); } catch { return null; }
}

function graphDigestV1(graph) {
  return createHash("sha256").update(JSON.stringify(graph)).digest("hex");
}

function normalizedSha256(value) {
  return typeof value === "string" ? value.replace(/^sha256:/u, "") : null;
}

function optionalArtifactSymlinkIsUnsafe(artifactRoot, relative) {
  const absolute = path.join(artifactRoot, relative);
  try {
    return lstatSync(absolute).isSymbolicLink();
  } catch (error) {
    return error?.code !== "ENOENT";
  }
}

function sanitizedGitEnvironment() {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return {
    ...environment,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
  };
}

function wikiReferencesMatch(wiki, graph) {
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const pagesById = new Map(wiki.pages.map((page) => [page.id, page]));
  const documentationByNodeId = new Map(wiki.nodeDocumentation.map((record) => [record.nodeId, record]));
  if (graphNodeIds.size !== graph.nodes.length
    || pagesById.size !== wiki.pages.length
    || documentationByNodeId.size !== wiki.nodeDocumentation.length
    || wiki.nodeDocumentation.length !== graph.nodes.length
    || graph.nodes.some((node) => !documentationByNodeId.has(node.id))) return false;
  for (const page of wiki.pages) {
    for (const nodeId of page.directNodeIds) {
      if (!graphNodeIds.has(nodeId) || !documentationByNodeId.get(nodeId)?.directPageIds.includes(page.id)) return false;
    }
    for (const nodeId of page.contextNodeIds) {
      if (!graphNodeIds.has(nodeId) || !documentationByNodeId.get(nodeId)?.contextPageIds.includes(page.id)) return false;
    }
  }
  for (const documentation of wiki.nodeDocumentation) {
    if (!graphNodeIds.has(documentation.nodeId)
      || documentation.directPageIds.some((pageId) => !pagesById.get(pageId)?.directNodeIds.includes(documentation.nodeId))
      || documentation.contextPageIds.some((pageId) => !pagesById.get(pageId)?.contextNodeIds.includes(documentation.nodeId))) return false;
  }
  return wiki.evidence.every((evidence) => evidence.nodeIds.every((nodeId) => graphNodeIds.has(nodeId)));
}

function searchReferencesMatch(search, wiki, graph) {
  const pagesById = new Map(wiki.pages.map((page) => [page.id, page]));
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const documentationByNodeId = new Map(wiki.nodeDocumentation.map((record) => [record.nodeId, record]));
  const recordIds = new Set();
  const pageRecordCounts = new Map(wiki.pages.map((page) => [page.id, 0]));
  const symbolRecordCounts = new Map(graph.nodes
    .filter((node) => node.type === "function" || node.type === "class")
    .map((node) => [node.id, 0]));
  for (const record of search.records) {
    if (recordIds.has(record.id)) return false;
    recordIds.add(record.id);
    const page = pagesById.get(record.pageId);
    if (!page || record.role !== page.role || record.category !== page.category) return false;
    if (record.kind === "page") {
      pageRecordCounts.set(page.id, (pageRecordCounts.get(page.id) ?? 0) + 1);
      continue;
    }
    if (!record.anchor || !record.nodeId) return false;
    const node = nodesById.get(record.nodeId);
    const documentation = documentationByNodeId.get(record.nodeId);
    if (!node || !documentation || record.relation !== "direct" || page.category !== "file"
      || !documentation.directPageIds.includes(page.id)) return false;
    if (node.filePath !== undefined && record.filePath !== node.filePath) return false;
    if (symbolRecordCounts.has(node.id)) {
      symbolRecordCounts.set(node.id, (symbolRecordCounts.get(node.id) ?? 0) + 1);
    }
  }
  if (![...pageRecordCounts.values()].every((count) => count === 1)
    || ![...symbolRecordCounts.values()].every((count) => count === 1)) return false;
  return wiki.nodeDocumentation.every((documentation) => documentation.primaryPageId === undefined
    || documentation.anchor === undefined
    || search.records.some((record) => record.kind === "symbol"
      && record.nodeId === documentation.nodeId
      && record.pageId === documentation.primaryPageId
      && record.anchor === documentation.anchor));
}

function knowledgeMarkdownRelative(markdownPath) {
  if (typeof markdownPath !== "string" || !markdownPath.startsWith("knowledge-base/") || markdownPath.includes("\0")) return null;
  const relative = markdownPath.slice("knowledge-base/".length).replaceAll("\\", "/");
  if (!relative || relative.startsWith("/")
    || relative.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  const safe = safeRelative(relative);
  return safe === relative ? safe : null;
}

function rootForMode({ root, demo }) {
  const candidate = demo ? DEMO_ROOT : root;
  if (!candidate) throw new Error("missing root");
  if (!path.isAbsolute(candidate)) throw new Error("root must be absolute");
  if (!existsSync(candidate)) throw new Error("not_ready: requested root does not exist");
  const resolved = realpathSync(candidate);
  if (!demo) {
    if (path.resolve(candidate) !== resolved) {
      throw new Error("not_ready: --root must be the canonical Git worktree root");
    }
    try {
      const gitRoot = realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: resolved,
        encoding: "utf8",
        env: sanitizedGitEnvironment(),
      }).trim());
      if (gitRoot !== resolved) throw new Error("root_not_worktree_top_level");
    } catch (error) {
      throw new Error(error instanceof Error && error.message === "root_not_worktree_top_level"
        ? "not_ready: --root must be the canonical Git worktree root"
        : "not_ready: --root is not a readable Git worktree");
    }
  }
  const artifactRoot = path.join(resolved, ".understand-code");
  let canonicalArtifactRoot;
  try { canonicalArtifactRoot = realpathSync(artifactRoot); } catch { throw new Error("not_ready: no knowledge graph; run /understand first"); }
  if (!isInside(resolved, canonicalArtifactRoot) || canonicalArtifactRoot !== artifactRoot) {
    throw new Error("not_ready: artifact root must not be a symbolic-link escape");
  }
  for (const relative of [
    "knowledge-graph.json",
    "meta.json",
    "config.json",
    "domain-graph.json",
    "diff-overlay.json",
    "knowledge-base/wiki-index.json",
    "knowledge-base/search-index.json",
  ]) {
    if (optionalArtifactSymlinkIsUnsafe(artifactRoot, relative)) {
      throw new Error("not_ready: published artifacts must not be symbolic links");
    }
  }
  const rawGraph = readContainedJson(artifactRoot, "knowledge-graph.json");
  const graphResult = validateGraph(rawGraph);
  if (!graphResult.success || graphResult.data === undefined || graphResult.issues.length > 0) {
    throw new Error("not_ready: knowledge-graph.json failed structural validation");
  }
  const graph = graphResult.data;
  let head = null;
  let verifiedMeta;
  if (!demo) {
    try {
      head = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: resolved,
        encoding: "utf8",
        env: sanitizedGitEnvironment(),
      }).trim();
    } catch {
      throw new Error("not_ready: cannot verify published graph revision");
    }
    if (graph.project.gitCommitHash !== head) {
      throw new Error("not_ready: published graph is stale for the current Git HEAD");
    }
    const meta = readContainedJson(artifactRoot, "meta.json", MAX_KB_BYTES);
    if (meta === null || meta.gitCommitHash !== head) {
      throw new Error("not_ready: published metadata is stale for the current Git HEAD");
    }
    verifiedMeta = meta;
  } else {
    verifiedMeta = readContainedJson(artifactRoot, "meta.json", MAX_KB_BYTES);
  }
  const verifiedConfig = readContainedJson(artifactRoot, "config.json", MAX_KB_BYTES);
  const wikiIndexPath = path.join(artifactRoot, "knowledge-base/wiki-index.json");
  const wikiExists = existsSync(wikiIndexPath);
  const searchIndexPath = path.join(artifactRoot, "knowledge-base/search-index.json");
  const searchExists = existsSync(searchIndexPath);
  const rawWiki = readContainedJson(artifactRoot, "knowledge-base/wiki-index.json", MAX_KB_BYTES);
  const wikiResult = rawWiki === null ? null : parseWikiIndexV2(rawWiki);
  const wiki = wikiResult?.ok ? wikiResult.value : null;
  if (wikiExists && wiki === null) throw new Error("not_ready: wiki-index.json failed V2 validation");
  if (!wikiExists && searchExists) throw new Error("not_ready: search-index.json exists without Wiki V2");
  if (wiki !== null) {
    if (!wikiReferencesMatch(wiki, graph)) {
      throw new Error("not_ready: published Wiki references do not match the current knowledge graph");
    }
    if (!demo && wiki.source.gitCommitHash !== head) {
      throw new Error("not_ready: published Wiki is stale for the current Git HEAD");
    }
    if (!demo && wiki.source.sourceRootIdentity !== resolved) {
      throw new Error("not_ready: published Wiki is bound to a different source root");
    }
    const expectedGraphDigest = graphDigestV1(graph);
    if (normalizedSha256(wiki.source.graphDigest) !== expectedGraphDigest) {
      throw new Error("not_ready: published Wiki does not bind the current knowledge graph");
    }
    const rawSearch = readContainedJson(artifactRoot, "knowledge-base/search-index.json", MAX_KB_BYTES);
    const searchResult = parseWikiSearchIndexV2(rawSearch);
    if (!searchResult.ok || searchResult.value.generatedAt !== wiki.generatedAt
      || !searchResult.value.records.every((record) => wiki.pages.some((page) => page.id === record.pageId))
      || searchResult.value.records.some((record) => record.filePath && SENSITIVE.test(record.filePath))
      || !searchReferencesMatch(searchResult.value, wiki, graph)) {
      throw new Error("not_ready: search-index.json failed V2 validation");
    }
    const search = searchResult.value;
    const kbRoot = path.join(artifactRoot, "knowledge-base");
    const markdownByPath = new Map();
    for (const page of wiki.pages) {
      const relative = knowledgeMarkdownRelative(page.markdownPath);
      const bytes = relative ? readContained(kbRoot, relative, MAX_KB_BYTES) : null;
      if (!relative || !bytes) throw new Error("not_ready: wiki-index.json references a missing or unsafe Markdown page");
      markdownByPath.set(relative, bytes);
    }
    return {
      root: resolved,
      artifactRoot,
      graph,
      wiki,
      search,
      markdownByPath,
      meta: verifiedMeta,
      config: verifiedConfig,
      head,
      mode: demo ? "demo" : "root",
    };
  }
  return { root: resolved, artifactRoot, graph, wiki: null, search: null, markdownByPath: new Map(), meta: verifiedMeta, config: verifiedConfig, head, mode: demo ? "demo" : "root" };
}

function sanitizeGraph(graph, projectRoot) {
  if (!Array.isArray(graph.nodes)) return graph;
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (!node || typeof node !== "object" || typeof node.filePath !== "string") return node;
      if (!path.isAbsolute(node.filePath)) return node;
      const absolute = path.resolve(node.filePath);
      return { ...node, filePath: isInside(projectRoot, absolute) ? path.relative(projectRoot, absolute).split(path.sep).join("/") : path.basename(absolute) };
    }),
  };
}

function redactRootText(value, projectRoot) {
  if (!value.includes(projectRoot)) return value;
  const escaped = projectRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return value.replace(new RegExp(`${escaped}(?=$|[\\s/\\\\:#?.,;!\"'\`\\)\\]\\}])`, "gu"), ".");
}

function sanitizeArtifactValue(value, projectRoot, key = "") {
  if (typeof value === "string") {
    const redacted = redactRootText(value, projectRoot);
    if (["canonicalRoot", "root", "sourceRootIdentity", "filePath"].includes(key) && path.isAbsolute(redacted)) {
      const absolute = path.resolve(redacted);
      return isInside(projectRoot, absolute)
        ? path.relative(projectRoot, absolute).split(path.sep).join("/") || "."
        : path.basename(absolute);
    }
    return redacted;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeArtifactValue(item, projectRoot));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeArtifactValue(entryValue, projectRoot, entryKey),
    ]),
  );
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2" })[ext] ?? "application/octet-stream";
}

function securityHeaders(res) {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; font-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
}

function allowedSourcePaths(graph, projectRoot) {
  return new Set((graph.nodes ?? []).flatMap((node) => {
    if (typeof node?.filePath !== "string") return [];
    const candidate = path.isAbsolute(node.filePath) ? path.resolve(node.filePath) : path.resolve(projectRoot, node.filePath);
    if (!isInside(projectRoot, candidate)) return [];
    return [path.relative(projectRoot, candidate).split(path.sep).join("/")];
  }));
}

function allowedKnowledgePaths(wiki) {
  const values = wiki === null ? [] : ["wiki-index.json", "search-index.json"];
  for (const page of wiki?.pages ?? []) {
    const relative = knowledgeMarkdownRelative(page?.markdownPath);
    if (relative !== null) values.push(relative);
  }
  return new Set(values.filter((value) => !SENSITIVE.test(value)).map((value) => path.posix.normalize(value)));
}

function parseRequestUrl(rawUrl) {
  if (/%(?![0-9a-f]{2})/iu.test(rawUrl)) return null;
  try {
    decodeURI(rawUrl);
    return new URL(rawUrl, "http://127.0.0.1");
  } catch {
    return null;
  }
}

function readContained(root, relative, maxBytes) {
  const safe = safeRelative(relative);
  if (!safe || SENSITIVE.test(safe)) return null;
  const absolute = path.resolve(root, safe);
  if (!isInside(root, absolute) || !existsSync(absolute)) return null;
  const pathParts = path.relative(root, absolute).split(path.sep);
  let cursor = root;
  try {
    for (const part of pathParts) {
      cursor = path.join(cursor, part);
      if (lstatSync(cursor).isSymbolicLink()) return null;
    }
  } catch {
    return null;
  }
  let real;
  try { real = realpathSync(absolute); } catch { return null; }
  if (!isInside(root, real)) return null;
  let descriptor;
  try {
    descriptor = openSync(real, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    const bytes = readFileSync(descriptor);
    return bytes.byteLength <= maxBytes ? bytes : null;
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readCommittedSource(root, revision, relative, maxBytes) {
  const safe = safeRelative(relative);
  if (!safe || SENSITIVE.test(safe)) return null;
  let bytes;
  try {
    bytes = execFileSync("git", ["show", `${revision}:${safe}`], {
      cwd: root,
      maxBuffer: maxBytes + 1,
      env: sanitizedGitEnvironment(),
    });
  } catch {
    return null;
  }
  return bytes.byteLength <= maxBytes ? bytes : null;
}

function createRequestHandler(state, token) {
  const publicGraph = sanitizeArtifactValue(sanitizeGraph(state.graph, state.root), state.root);
  const publicWiki = state.wiki === null ? null : sanitizeArtifactValue(state.wiki, state.root);
  const publicSearch = state.search === null ? null : sanitizeArtifactValue(state.search, state.root);
  const rawMeta = state.meta;
  const publicMeta = sanitizeArtifactValue(rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
    ? Object.fromEntries(Object.entries(rawMeta).filter(([key]) => !["canonicalRoot", "root", "sourceRootIdentity"].includes(key)))
    : { version: "preview", analyzedFiles: state.graph.nodes.length }, state.root);
  const rawConfig = state.config;
  const publicConfig = sanitizeArtifactValue(rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig)
    ? Object.fromEntries(Object.entries(rawConfig).filter(([key]) => !["canonicalRoot", "root", "sourceRootIdentity"].includes(key)))
    : { autoUpdate: false, outputLanguage: "zh" }, state.root);
  const sourceAllow = allowedSourcePaths(state.graph, state.root);
  const kbAllow = allowedKnowledgePaths(state.wiki);
  return (req, res) => {
    securityHeaders(res);
    const url = parseRequestUrl(req.url ?? "/");
    if (url === null) { json(res, 400, { error: "bad_request" }); return; }
    const dataEndpoint = url.pathname === "/knowledge-graph.json" || url.pathname === "/domain-graph.json" || url.pathname === "/diff-overlay.json" || url.pathname === "/meta.json" || url.pathname === "/config.json" || url.pathname === "/file-content.json" || url.pathname.startsWith("/knowledge-base/");
    if (dataEndpoint && req.method !== "GET") { res.setHeader("Allow", "GET"); json(res, 405, { error: "method_not_allowed" }); return; }
    if (dataEndpoint && url.searchParams.get("token") !== token) { json(res, 403, { error: "forbidden" }); return; }

    if (url.pathname === "/knowledge-graph.json") { json(res, 200, publicGraph); return; }
    if (url.pathname === "/meta.json") { json(res, 200, publicMeta); return; }
    if (url.pathname === "/config.json") { json(res, 200, publicConfig); return; }
    if (["/domain-graph.json", "/diff-overlay.json"].includes(url.pathname)) { json(res, 404, { error: "artifact_not_available_in_preview" }); return; }
    if (url.pathname === "/file-content.json") {
      const requested = url.searchParams.get("path");
      if (!requested || !sourceAllow.has(path.posix.normalize(requested.replaceAll("\\", "/")))) { json(res, 404, { error: "file_not_available" }); return; }
      const bytes = state.mode === "root"
        ? readCommittedSource(state.root, state.head, requested, MAX_SOURCE_BYTES)
        : readContained(state.root, requested, MAX_SOURCE_BYTES);
      if (!bytes || bytes.includes(0)) { json(res, 404, { error: "file_not_available" }); return; }
      const rawContent = bytes.toString("utf8");
      const content = redactRootText(rawContent, state.root);
      json(res, 200, { path: requested, content, sizeBytes: bytes.byteLength, lineCount: content ? content.split(/\r\n|\n|\r/).length : 0 }); return;
    }
    if (url.pathname.startsWith("/knowledge-base/")) {
      const relative = safeRelative(url.pathname.slice("/knowledge-base/".length));
      if (!relative || !kbAllow.has(relative)) { json(res, 404, { error: "knowledge_file_not_available" }); return; }
      const bytes = relative === "wiki-index.json"
        ? publicWiki === null ? null : Buffer.from(JSON.stringify(publicWiki))
        : relative === "search-index.json"
          ? publicSearch === null ? null : Buffer.from(JSON.stringify(publicSearch))
          : state.markdownByPath.get(relative) ?? null;
      if (!bytes) { json(res, 404, { error: "knowledge_file_not_available" }); return; }
      res.statusCode = 200;
      res.setHeader("Content-Type", mime(relative));
      if (path.extname(relative).toLowerCase() === ".json") res.end(bytes);
      else {
        res.end(redactRootText(bytes.toString("utf8"), state.root));
      }
      return;
    }
    const requestedStatic = url.pathname === "/" ? "index.html" : safeRelative(url.pathname.slice(1));
    if (requestedStatic === null) { json(res, 404, { error: "not_found" }); return; }
    const relative = requestedStatic;
    let file = path.resolve(DASHBOARD_ROOT, relative);
    if (!isInside(DASHBOARD_ROOT, file) || !existsSync(file) || !lstatSync(file).isFile()) file = path.join(DASHBOARD_ROOT, "index.html");
    try { res.statusCode = 200; res.setHeader("Content-Type", mime(file)); res.end(readFileSync(file)); } catch { json(res, 500, { error: "static_read_failed" }); }
  };
}

export async function startPreview({ root = null, demo = false, port = 0 }) {
  const state = rootForMode({ root, demo });
  const token = randomBytes(16).toString("hex");
  const server = createServer(createRequestHandler(state, token));
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  const url = `http://127.0.0.1:${actualPort}/?token=${token}`;
  process.stdout.write(`PREVIEW_READY ${JSON.stringify({ url, token, mode: state.mode, wiki: state.wiki ? "ready" : "missing" })}\n`);
  process.stdout.write(`Open: ${url}\n`);
  const close = () => server.close();
  process.once("SIGINT", close); process.once("SIGTERM", close);
  return { server, url, token, state };
}
