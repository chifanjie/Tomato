import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalizeJson,
  getRepositorySnapshotDetailed,
  isSensitiveRepositoryPath,
  parseWikiIndexV2,
  parseWikiSearchIndexV2,
  ChangeCheckArtifactV1Schema,
  RepoPulseArtifactV1Schema,
  TaskBriefArtifactV1Schema,
  TaskManifestArtifactV1Schema,
  VerificationArtifactV1Schema,
  readStableRepositoryFile,
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
const MAX_TASK_BYTES = 4 * 1024 * 1024;
const TASK_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/u;
const TASK_BRIEF_SECTIONS = new Set([
  "summary",
  "goals",
  "reading_path",
  "planned_changes",
  "assumptions",
  "risks",
  "unknowns",
  "verification_plan",
]);

const TASK_ARTIFACT_DEFINITIONS = Object.freeze({
  "change-check": Object.freeze({
    relative: "change-check.json",
    schema: ChangeCheckArtifactV1Schema,
    field: "changeCheck",
  }),
  verification: Object.freeze({
    relative: "verification.json",
    schema: VerificationArtifactV1Schema,
    field: "verification",
  }),
});

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
  if (isSensitiveRepositoryPath(normalized)) return null;
  return normalized;
}

async function readContainedJson(root, relative, maxBytes = MAX_ARTIFACT_BYTES) {
  const bytes = await readContained(root, relative, maxBytes);
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
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
  );
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

function repositoryPathForPolicy(value, projectRoot) {
  if (typeof value !== "string") return null;
  if (!path.isAbsolute(value)) return value.replaceAll("\\", "/");
  const absolute = path.resolve(value);
  return isInside(projectRoot, absolute)
    ? path.relative(projectRoot, absolute).split(path.sep).join("/")
    : value;
}

function containsSensitiveArtifactPath(values, projectRoot) {
  return values.some((value) => {
    const repositoryPath = repositoryPathForPolicy(value, projectRoot);
    return repositoryPath !== null && isSensitiveRepositoryPath(repositoryPath);
  });
}

function assertCleanRootCapture(capture, expectedSnapshotId) {
  const snapshot = capture?.snapshot;
  if (snapshot?.captureStatus !== "complete" || snapshot.changes.length !== 0) {
    throw new Error("not_ready: Preview --root requires a clean Git Index and Worktree snapshot");
  }
  if (expectedSnapshotId !== undefined && snapshot.snapshotId !== expectedSnapshotId) {
    throw new Error("not_ready: repository state changed across the Preview snapshot boundary");
  }
  return snapshot;
}

async function rootForMode({ root, demo }, gitEnvironment) {
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
        env: gitEnvironment,
      }).trim());
      if (gitRoot !== resolved) throw new Error("root_not_worktree_top_level");
    } catch (error) {
      throw new Error(error instanceof Error && error.message === "root_not_worktree_top_level"
        ? "not_ready: --root must be the canonical Git worktree root"
        : "not_ready: --root is not a readable Git worktree");
    }
  }
  let repositorySnapshotId = null;
  let repositoryId = null;
  let worktreeId = null;
  let head = null;
  if (!demo) {
    const initialCapture = await getRepositorySnapshotDetailed(resolved, { environment: gitEnvironment });
    if (initialCapture.canonicalRoot !== resolved) {
      throw new Error("not_ready: --root must be the canonical Git worktree root");
    }
    const initialSnapshot = assertCleanRootCapture(initialCapture);
    repositorySnapshotId = initialSnapshot.snapshotId;
    repositoryId = initialSnapshot.repositoryId;
    worktreeId = initialSnapshot.worktreeId;
    head = initialSnapshot.headCommit ?? null;
    if (head === null) throw new Error("not_ready: cannot verify published graph revision");
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
  const rawGraph = await readContainedJson(resolved, ".understand-code/knowledge-graph.json");
  const graphResult = validateGraph(rawGraph);
  if (!graphResult.success || graphResult.data === undefined || graphResult.issues.length > 0) {
    throw new Error("not_ready: knowledge-graph.json failed structural validation");
  }
  const graph = graphResult.data;
  if (containsSensitiveArtifactPath(graph.nodes.map((node) => node.filePath), resolved)) {
    throw new Error("not_ready: knowledge graph contains a sensitive source path");
  }
  let verifiedMeta;
  if (!demo) {
    if (graph.project.gitCommitHash !== head) {
      throw new Error("not_ready: published graph is stale for the current Git HEAD");
    }
    const meta = await readContainedJson(resolved, ".understand-code/meta.json", MAX_KB_BYTES);
    if (meta === null || meta.gitCommitHash !== head) {
      throw new Error("not_ready: published metadata is stale for the current Git HEAD");
    }
    verifiedMeta = meta;
  } else {
    verifiedMeta = await readContainedJson(resolved, ".understand-code/meta.json", MAX_KB_BYTES);
  }
  const verifiedConfig = await readContainedJson(resolved, ".understand-code/config.json", MAX_KB_BYTES);
  const wikiIndexPath = path.join(artifactRoot, "knowledge-base/wiki-index.json");
  const wikiExists = existsSync(wikiIndexPath);
  const searchIndexPath = path.join(artifactRoot, "knowledge-base/search-index.json");
  const searchExists = existsSync(searchIndexPath);
  const rawWiki = await readContainedJson(resolved, ".understand-code/knowledge-base/wiki-index.json", MAX_KB_BYTES);
  const wikiResult = rawWiki === null ? null : parseWikiIndexV2(rawWiki);
  const wiki = wikiResult?.ok ? wikiResult.value : null;
  if (wikiExists && wiki === null) throw new Error("not_ready: wiki-index.json failed V2 validation");
  if (!wikiExists && searchExists) throw new Error("not_ready: search-index.json exists without Wiki V2");
  if (wiki !== null) {
    if (containsSensitiveArtifactPath(wiki.evidence.map((evidence) => evidence.filePath), resolved)) {
      throw new Error("not_ready: published Wiki contains a sensitive evidence path");
    }
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
    const rawSearch = await readContainedJson(resolved, ".understand-code/knowledge-base/search-index.json", MAX_KB_BYTES);
    const searchResult = parseWikiSearchIndexV2(rawSearch);
    if (!searchResult.ok || searchResult.value.generatedAt !== wiki.generatedAt
      || !searchResult.value.records.every((record) => wiki.pages.some((page) => page.id === record.pageId))) {
      throw new Error("not_ready: search-index.json failed V2 validation");
    }
    const search = searchResult.value;
    if (containsSensitiveArtifactPath(search.records.map((record) => record.filePath), resolved)) {
      throw new Error("not_ready: published Search contains a sensitive source path");
    }
    if (!searchReferencesMatch(search, wiki, graph)) {
      throw new Error("not_ready: search-index.json failed V2 validation");
    }
    const markdownByPath = new Map();
    for (const page of wiki.pages) {
      const relative = knowledgeMarkdownRelative(page.markdownPath);
      const bytes = relative
        ? await readContained(resolved, `.understand-code/knowledge-base/${relative}`, MAX_KB_BYTES)
        : null;
      if (!relative || !bytes) throw new Error("not_ready: wiki-index.json references a missing or unsafe Markdown page");
      markdownByPath.set(relative, bytes);
    }
    if (!demo) assertCleanRootCapture(
      await getRepositorySnapshotDetailed(resolved, { environment: gitEnvironment }),
      repositorySnapshotId,
    );
    return { root: resolved, artifactRoot, graph, wiki, search, markdownByPath, meta: verifiedMeta, config: verifiedConfig, head, repositorySnapshotId, repositoryId, worktreeId, mode: demo ? "demo" : "root" };
  }
  if (!demo) assertCleanRootCapture(
    await getRepositorySnapshotDetailed(resolved, { environment: gitEnvironment }),
    repositorySnapshotId,
  );
  return { root: resolved, artifactRoot, graph, wiki: null, search: null, markdownByPath: new Map(), meta: verifiedMeta, config: verifiedConfig, head, repositorySnapshotId, repositoryId, worktreeId, mode: demo ? "demo" : "root" };
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

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function projectedStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : undefined;
}

function projectPublicMeta(rawMeta, graph) {
  if (!isRecord(rawMeta)) return { version: "preview", analyzedFiles: graph.nodes.length };
  const theme = isRecord(rawMeta.theme)
    ? {
        ...(typeof rawMeta.theme.presetId === "string" ? { presetId: rawMeta.theme.presetId } : {}),
        ...(typeof rawMeta.theme.accentId === "string" ? { accentId: rawMeta.theme.accentId } : {}),
      }
    : undefined;
  return {
    ...(typeof rawMeta.lastAnalyzedAt === "string" ? { lastAnalyzedAt: rawMeta.lastAnalyzedAt } : {}),
    ...(typeof rawMeta.gitCommitHash === "string" ? { gitCommitHash: rawMeta.gitCommitHash } : {}),
    ...(typeof rawMeta.version === "string" ? { version: rawMeta.version } : {}),
    ...(Number.isSafeInteger(rawMeta.analyzedFiles) && rawMeta.analyzedFiles >= 0 ? { analyzedFiles: rawMeta.analyzedFiles } : {}),
    ...(theme && Object.keys(theme).length > 0 ? { theme } : {}),
  };
}

function projectPublicConfig(rawConfig) {
  if (!isRecord(rawConfig)) return { autoUpdate: false, outputLanguage: "zh" };
  const knowledgeBase = isRecord(rawConfig.knowledgeBase) ? rawConfig.knowledgeBase : undefined;
  const route = isRecord(knowledgeBase?.route) ? knowledgeBase.route : undefined;
  const projectedRoute = route ? {
    ...(projectedStringArray(route.pin) ? { pin: projectedStringArray(route.pin) } : {}),
    ...(projectedStringArray(route.hide) ? { hide: projectedStringArray(route.hide) } : {}),
    ...(projectedStringArray(route.order) ? { order: projectedStringArray(route.order) } : {}),
  } : undefined;
  const projectedKnowledgeBase = knowledgeBase ? {
    ...(projectedStringArray(knowledgeBase.businessTerms) ? { businessTerms: projectedStringArray(knowledgeBase.businessTerms) } : {}),
    ...(projectedStringArray(knowledgeBase.entryNodeIds) ? { entryNodeIds: projectedStringArray(knowledgeBase.entryNodeIds) } : {}),
    ...(projectedRoute && Object.keys(projectedRoute).length > 0 ? { route: projectedRoute } : {}),
  } : undefined;
  return {
    autoUpdate: typeof rawConfig.autoUpdate === "boolean" ? rawConfig.autoUpdate : false,
    ...(typeof rawConfig.outputLanguage === "string" ? { outputLanguage: rawConfig.outputLanguage } : {}),
    ...(projectedKnowledgeBase && Object.keys(projectedKnowledgeBase).length > 0 ? { knowledgeBase: projectedKnowledgeBase } : {}),
  };
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
    const relative = path.relative(projectRoot, candidate).split(path.sep).join("/");
    return safeRelative(relative) === relative ? [relative] : [];
  }));
}

function allowedKnowledgePaths(wiki) {
  const values = wiki === null ? [] : ["wiki-index.json", "search-index.json"];
  for (const page of wiki?.pages ?? []) {
    const relative = knowledgeMarkdownRelative(page?.markdownPath);
    if (relative !== null) values.push(relative);
  }
  return new Set(values.filter((value) => !isSensitiveRepositoryPath(value)).map((value) => path.posix.normalize(value)));
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

async function readContained(root, relative, maxBytes) {
  const safe = safeRelative(relative);
  if (!safe) return null;
  try {
    return await readStableRepositoryFile(root, safe, maxBytes);
  } catch {
    return null;
  }
}

function decodeTaskId(value) {
  if (typeof value !== "string") return null;
  try {
    const decoded = decodeURIComponent(value);
    return TASK_ID_PATTERN.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function artifactContentDigestMatches(artifact) {
  if (!artifact || typeof artifact.contentDigest !== "string") return false;
  const actual = `sha256:${createHash("sha256").update(canonicalizeJson(artifact.payload), "utf8").digest("hex")}`;
  return artifact.contentDigest === actual;
}

function taskBriefItems(brief, section) {
  switch (section) {
    case "summary":
      return [{
        kind: "summary",
        originalIntent: brief.originalIntent,
        goalClaimId: brief.goalClaimId,
        acceptanceClaimCount: brief.acceptanceClaimIds.length,
        plannedChangeCount: brief.plannedChanges.length,
      }];
    case "goals":
      return [
        { kind: "claim_reference", role: "goal", claimId: brief.goalClaimId },
        ...brief.nonGoalClaimIds.map((claimId) => ({ kind: "claim_reference", role: "non_goal", claimId })),
        ...brief.acceptanceClaimIds.map((claimId) => ({ kind: "claim_reference", role: "acceptance", claimId })),
      ];
    case "reading_path":
      return brief.readingPath.map((entry) => ({ kind: "reading_path", entry }));
    case "planned_changes":
      return brief.plannedChanges.map((change) => ({ kind: "planned_change", change }));
    case "assumptions":
      return brief.assumptionClaimIds.map((claimId) => ({ kind: "claim_reference", role: "assumption", claimId }));
    case "risks":
      return brief.riskClaimIds.map((claimId) => ({ kind: "claim_reference", role: "risk", claimId }));
    case "unknowns":
      return brief.unknownClaimIds.map((claimId) => ({ kind: "claim_reference", role: "unknown", claimId }));
    case "verification_plan":
      return brief.verificationPlan.map((entry) => ({ kind: "verification_plan", entry }));
    default:
      return [];
  }
}

async function readTaskBriefProjection(state, taskId, section) {
  const taskRaw = await readContainedJson(
    state.root,
    `.understand-code/tasks/${taskId}/task.json`,
    MAX_TASK_BYTES,
  );
  const briefRaw = await readContainedJson(
    state.root,
    `.understand-code/tasks/${taskId}/task-brief.json`,
    MAX_TASK_BYTES,
  );
  if (taskRaw === null || briefRaw === null) return { status: "missing" };

  const taskResult = TaskManifestArtifactV1Schema.safeParse(taskRaw);
  const briefResult = TaskBriefArtifactV1Schema.safeParse(briefRaw);
  if (!taskResult.success || !briefResult.success
    || !artifactContentDigestMatches(taskResult.data)
    || !artifactContentDigestMatches(briefResult.data)) return { status: "invalid" };
  const task = taskResult.data;
  const brief = briefResult.data;
  if (task.taskId !== taskId || brief.taskId !== taskId
    || task.repositoryId !== brief.repositoryId
    || task.worktreeId !== brief.worktreeId
    || task.sourceSnapshotId !== brief.sourceSnapshotId
    || task.revision !== brief.revision) {
    return { status: "invalid" };
  }
  if (state.mode === "root"
    && (task.sourceSnapshotId !== state.repositorySnapshotId
      || task.repositoryId !== state.repositoryId
      || task.worktreeId !== state.worktreeId)) {
    return { status: "stale" };
  }

  let pulse = null;
  const pulseRaw = await readContainedJson(state.root, ".understand-code/repo-pulse.json", MAX_TASK_BYTES);
  if (pulseRaw !== null) {
    const pulseResult = RepoPulseArtifactV1Schema.safeParse(pulseRaw);
    if (pulseResult.success
      && artifactContentDigestMatches(pulseResult.data)
      && pulseResult.data.repositoryId === task.repositoryId
      && pulseResult.data.worktreeId === task.worktreeId
      && pulseResult.data.sourceSnapshotId === task.sourceSnapshotId) {
      pulse = pulseResult.data.payload;
    }
  }
  return {
    status: "ready",
    result: {
      task: task.payload,
      brief: brief.payload,
      section,
      items: taskBriefItems(brief.payload, section),
      pulse,
      freshness: {
        sourceSnapshotId: task.sourceSnapshotId,
        current: state.mode === "demo" || task.sourceSnapshotId === state.repositorySnapshotId,
      },
    },
  };
}

/**
 * Read one of the current, task-scoped Change Intelligence projections.
 *
 * The Preview surface never trusts a filename alone: the Task Manifest and
 * requested artifact must both parse as their exact envelope schema, carry the
 * same repository/worktree/snapshot/revision identity, and have a valid
 * payload-only SHA-256 digest.  A missing projection is an explicit 404 so a
 * context-ready Task can remain readable without inventing an empty Check or
 * Verification result.
 */
async function readTaskArtifactProjection(state, taskId, kind) {
  const definition = TASK_ARTIFACT_DEFINITIONS[kind];
  if (definition === undefined) return { status: "invalid" };

  const taskRaw = await readContainedJson(
    state.root,
    `.understand-code/tasks/${taskId}/task.json`,
    MAX_TASK_BYTES,
  );
  const artifactRaw = await readContainedJson(
    state.root,
    `.understand-code/tasks/${taskId}/${definition.relative}`,
    MAX_TASK_BYTES,
  );
  if (taskRaw === null || artifactRaw === null) return { status: "missing" };

  const taskResult = TaskManifestArtifactV1Schema.safeParse(taskRaw);
  const artifactResult = definition.schema.safeParse(artifactRaw);
  if (!taskResult.success || !artifactResult.success
    || !artifactContentDigestMatches(taskResult.data)
    || !artifactContentDigestMatches(artifactResult.data)) {
    return { status: "invalid" };
  }

  const task = taskResult.data;
  const artifact = artifactResult.data;
  if (task.taskId !== taskId
    || task.payload.taskId !== taskId
    || artifact.taskId !== taskId
    || artifact.repositoryId !== task.repositoryId
    || artifact.worktreeId !== task.worktreeId
    || artifact.sourceSnapshotId !== task.sourceSnapshotId
    || artifact.revision !== task.revision) {
    return { status: "invalid" };
  }

  // A current Check is named by the Task Manifest.  Verification is only a
  // valid current projection when that Check is present as well.
  if (kind === "change-check") {
    if (task.payload.currentChangeCheckId !== artifact.payload.id
      || task.payload.currentChangeCheckRevision !== artifact.payload.taskRevision) {
      return { status: "invalid" };
    }
  } else if (task.payload.currentChangeCheckId === undefined
    || task.payload.currentChangeCheckRevision === undefined) {
    return { status: "invalid" };
  }

  if (state.mode === "root"
    && (artifact.sourceSnapshotId !== state.repositorySnapshotId
      || artifact.repositoryId !== state.repositoryId
      || artifact.worktreeId !== state.worktreeId)) {
    return { status: "stale" };
  }

  return {
    status: "ready",
    result: {
      task: task.payload,
      artifact,
      freshness: {
        sourceSnapshotId: artifact.sourceSnapshotId,
        current: state.mode === "demo" || artifact.sourceSnapshotId === state.repositorySnapshotId,
      },
    },
  };
}

function readCommittedSource(root, revision, relative, maxBytes, gitEnvironment) {
  const safe = safeRelative(relative);
  if (!safe) return null;
  let bytes;
  try {
    bytes = execFileSync("git", ["show", `${revision}:${safe}`], {
      cwd: root,
      maxBuffer: maxBytes + 1,
      env: gitEnvironment,
    });
  } catch {
    return null;
  }
  return bytes.byteLength <= maxBytes ? bytes : null;
}

function createRequestHandler(state, token, gitEnvironment) {
  const publicGraph = sanitizeArtifactValue(sanitizeGraph(state.graph, state.root), state.root);
  const publicWiki = state.wiki === null ? null : sanitizeArtifactValue(state.wiki, state.root);
  const publicSearch = state.search === null ? null : sanitizeArtifactValue(state.search, state.root);
  const publicMeta = sanitizeArtifactValue(projectPublicMeta(state.meta, state.graph), state.root);
  const publicConfig = sanitizeArtifactValue(projectPublicConfig(state.config), state.root);
  const sourceAllow = allowedSourcePaths(state.graph, state.root);
  const kbAllow = allowedKnowledgePaths(state.wiki);
  return async (req, res) => {
    securityHeaders(res);
    const url = parseRequestUrl(req.url ?? "/");
    if (url === null) { json(res, 400, { error: "bad_request" }); return; }
    const taskPathMatch = /^\/tasks\/([^/]+)\/(brief|change-check|verification)\.json$/u.exec(url.pathname);
    const taskId = taskPathMatch ? decodeTaskId(taskPathMatch[1]) : null;
    const taskEndpoint = taskPathMatch !== null;
    const taskEndpointKind = taskPathMatch?.[2] ?? null;
    const dataEndpoint = taskEndpoint || url.pathname === "/knowledge-graph.json" || url.pathname === "/domain-graph.json" || url.pathname === "/diff-overlay.json" || url.pathname === "/meta.json" || url.pathname === "/config.json" || url.pathname === "/file-content.json" || url.pathname.startsWith("/knowledge-base/");
    if (dataEndpoint && req.method !== "GET") { res.setHeader("Allow", "GET"); json(res, 405, { error: "method_not_allowed" }); return; }
    if (dataEndpoint && url.searchParams.get("token") !== token) { json(res, 403, { error: "forbidden" }); return; }
    if (taskEndpoint && taskId === null) {
      json(res, 404, { error: `${taskEndpointKind ?? "task"}_not_available` });
      return;
    }
    if (dataEndpoint && state.mode === "root") {
      const currentCapture = await getRepositorySnapshotDetailed(state.root, { environment: gitEnvironment });
      const currentSnapshot = currentCapture.snapshot;
      if (currentCapture.canonicalRoot !== state.root
        || currentSnapshot.captureStatus !== "complete"
        || currentSnapshot.changes.length !== 0
        || currentSnapshot.snapshotId !== state.repositorySnapshotId) {
        json(res, 409, { error: "repository_state_changed" }); return;
      }
    }

    if (taskEndpoint) {
      if (taskEndpointKind === "brief") {
        const section = url.searchParams.get("section") ?? "summary";
        if (!TASK_BRIEF_SECTIONS.has(section)) {
          json(res, 400, { error: "invalid_task_brief_section" });
          return;
        }
        const projection = await readTaskBriefProjection(state, taskId, section);
        if (projection.status === "missing") {
          json(res, 404, { error: "task_brief_not_available" });
          return;
        }
        if (projection.status === "invalid") {
          json(res, 422, { error: "task_brief_invalid" });
          return;
        }
        if (projection.status === "stale") {
          json(res, 409, { error: "task_brief_stale" });
          return;
        }
        json(res, 200, projection.result);
        return;
      }

      const projection = await readTaskArtifactProjection(state, taskId, taskEndpointKind);
      if (projection.status === "missing") {
        json(res, 404, { error: `${taskEndpointKind}_not_available` });
        return;
      }
      if (projection.status === "invalid") {
        json(res, 422, { error: `${taskEndpointKind}_invalid` });
        return;
      }
      if (projection.status === "stale") {
        json(res, 409, { error: `${taskEndpointKind}_stale` });
        return;
      }
      json(res, 200, projection.result);
      return;
    }

    if (url.pathname === "/knowledge-graph.json") { json(res, 200, publicGraph); return; }
    if (url.pathname === "/meta.json") { json(res, 200, publicMeta); return; }
    if (url.pathname === "/config.json") { json(res, 200, publicConfig); return; }
    if (["/domain-graph.json", "/diff-overlay.json"].includes(url.pathname)) { json(res, 404, { error: "artifact_not_available_in_preview" }); return; }
    if (url.pathname === "/file-content.json") {
      const requested = url.searchParams.get("path");
      const safeRequested = requested ? safeRelative(requested) : null;
      if (!safeRequested || !sourceAllow.has(safeRequested)) { json(res, 404, { error: "file_not_available" }); return; }
      const bytes = state.mode === "root"
        ? readCommittedSource(state.root, state.head, safeRequested, MAX_SOURCE_BYTES, gitEnvironment)
        : await readContained(state.root, safeRequested, MAX_SOURCE_BYTES);
      if (!bytes || bytes.includes(0)) { json(res, 404, { error: "file_not_available" }); return; }
      const rawContent = bytes.toString("utf8");
      const content = redactRootText(rawContent, state.root);
      json(res, 200, { path: safeRequested, content, sizeBytes: bytes.byteLength, lineCount: content ? content.split(/\r\n|\n|\r/).length : 0 }); return;
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
  const gitEnvironment = sanitizedGitEnvironment();
  const state = await rootForMode({ root, demo }, gitEnvironment);
  const token = randomBytes(16).toString("hex");
  const handler = createRequestHandler(state, token, gitEnvironment);
  const server = createServer((req, res) => {
    void handler(req, res).catch(() => {
      if (!res.headersSent) json(res, 500, { error: "preview_request_failed" });
      else res.destroy();
    });
  });
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
