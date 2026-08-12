import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { spawn } from "node:child_process";

const packageRoot = path.resolve(new URL("..", import.meta.url).pathname);
const bin = path.join(packageRoot, "dist/bin.mjs");
const execFileAsync = promisify(execFile);
const PROCESS_TIMEOUT_MS = 10_000;

function withTimeout(promise, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function start(args) {
  const child = spawn(process.execPath, [bin, ...args], { cwd: "/tmp", stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const ready = withTimeout(new Promise((resolve, reject) => {
    let settled = false;
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const line = output.split("\n").find((item) => item.startsWith("PREVIEW_READY "));
      if (!line || settled) return;
      try {
        settled = true;
        resolve(JSON.parse(line.slice("PREVIEW_READY ".length)));
      } catch (error) {
        reject(error);
      }
    });
    child.once("error", (error) => { if (!settled) { settled = true; reject(error); } });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      reject(new Error(`preview exited before ready (code=${code}, signal=${signal}): ${stderr || output}`));
    });
  }), "preview ready");
  return { child, ready };
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  child.kill("SIGTERM");
  try {
    await withTimeout(exited, "preview shutdown", 2_000);
  } catch {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    if (child.exitCode === null && child.signalCode === null) {
      await withTimeout(new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", resolve);
      }), "preview forced shutdown", 2_000);
    }
  }
}

async function expectExit(args, expectedPattern) {
  const child = spawn(process.execPath, [bin, ...args], { cwd: "/tmp", stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  try {
    const [code] = await withTimeout(new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (...values) => resolve(values));
    }), `preview rejection: ${args.join(" ")}`);
    assert.equal(code, 2, `unexpected exit ${code}: ${stderr}`);
    assert.match(stderr, expectedPattern);
  } finally {
    await stop(child);
  }
}

test("cold demo serves usable Graph/Wiki and protects data endpoints", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [bin, "--root", "relative/path", "--no-open"], { cwd: "/tmp", encoding: "utf8" }),
    (error) => error && error.code === 2 && /--root must be an absolute path/u.test(error.stderr),
  );
  const first = start(["--demo", "--port", "0", "--no-open"]);
  let token;
  try {
    const info = await first.ready;
    const base = new URL(info.url);
    token = base.searchParams.get("token");
    assert.ok(token);
    const graph = await fetch(`${base.origin}/knowledge-graph.json?token=${token}`);
    assert.equal(graph.status, 200);
    assert.equal((await graph.json()).nodes.length, 3);
    const wiki = await fetch(`${base.origin}/knowledge-base/wiki-index.json?token=${token}`);
    assert.equal(wiki.status, 200);
    assert.equal((await wiki.json()).version, 2);
    assert.equal((await fetch(`${base.origin}/knowledge-graph.json`)).status, 403);
    assert.equal((await fetch(`${base.origin}/knowledge-base/项目总览.md?token=bad`)).status, 403);
    assert.equal((await fetch(`${base.origin}/knowledge-base/..%2F..%2Fetc%2Fpasswd?token=${token}`)).status, 404);
    assert.equal((await fetch(`${base.origin}/file-content.json?path=../etc/passwd&token=${token}`)).status, 404);
    for (const sensitive of [".env", ".npmrc", ".aws/credentials", "secrets/token.txt", "private.pem"]) {
      assert.equal((await fetch(`${base.origin}/file-content.json?path=${encodeURIComponent(sensitive)}&token=${token}`)).status, 404);
      assert.equal((await fetch(`${base.origin}/knowledge-base/${encodeURIComponent(sensitive)}?token=${token}`)).status, 404);
    }
    assert.equal((await fetch(`${base.origin}/knowledge-graph.json?token=${token}`, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${base.origin}/%ZZ`)).status, 400);
    const publicGraph = await (await fetch(`${base.origin}/knowledge-graph.json?token=${token}`)).text();
    assert.doesNotMatch(publicGraph, new RegExp(packageRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    assert.doesNotMatch(publicGraph, new RegExp(token, "u"));
  } finally {
    await stop(first.child);
  }
  const second = start(["--demo", "--port", "0", "--no-open"]);
  try {
    const secondInfo = await second.ready;
    assert.notEqual(new URL(secondInfo.url).searchParams.get("token"), token);
  } finally {
    await stop(second.child);
  }
});

async function git(root, args) {
  return execFileAsync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Preview Test",
      GIT_AUTHOR_EMAIL: "preview@example.invalid",
      GIT_COMMITTER_NAME: "Preview Test",
      GIT_COMMITTER_EMAIL: "preview@example.invalid",
    },
  });
}

async function createPublishedRoot() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "preview-published-root-")));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src/app.ts"), [
    "export function main() { return 'ready'; }",
    `export const sourceRoot = ${JSON.stringify(`${root}/private`)};`,
    `export const lookalikeRoot = ${JSON.stringify(`${root}-sibling`)};`,
    "",
  ].join("\n"));
  await git(root, ["init", "-q"]);
  await git(root, ["add", "src/app.ts"]);
  await git(root, ["commit", "-q", "-m", "preview fixture"]);
  await cp(path.join(packageRoot, "dist/demo/.understand-code"), path.join(root, ".understand-code"), { recursive: true });
  const head = (await git(root, ["rev-parse", "HEAD"])).stdout.trim();
  const graphPath = path.join(root, ".understand-code/knowledge-graph.json");
  const graph = JSON.parse(await readFile(graphPath, "utf8"));
  for (const node of graph.nodes) {
    if (node.filePath === "src/app.ts") node.filePath = path.join(root, "src/app.ts");
  }
  await writeFile(graphPath, `${JSON.stringify({ ...graph, project: { ...graph.project, gitCommitHash: head } }, null, 2)}\n`);
  const currentGraph = JSON.parse(await readFile(graphPath, "utf8"));
  const graphDigest = createHash("sha256").update(JSON.stringify(currentGraph)).digest("hex");
  const metaPath = path.join(root, ".understand-code/meta.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  meta.gitCommitHash = head;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  const kbRoot = path.join(root, ".understand-code/knowledge-base");
  const wikiPath = path.join(kbRoot, "wiki-index.json");
  const wiki = JSON.parse(await readFile(wikiPath, "utf8"));
  wiki.source.sourceRootIdentity = root;
  wiki.source.gitCommitHash = head;
  wiki.source.graphDigest = graphDigest;
  wiki.evidence[0].filePath = path.join(root, "src/app.ts");
  await writeFile(wikiPath, `${JSON.stringify(wiki, null, 2)}\n`);
  const searchPath = path.join(kbRoot, "search-index.json");
  const search = JSON.parse(await readFile(searchPath, "utf8"));
  search.records.find((record) => record.kind === "symbol").filePath = path.join(root, "src/app.ts");
  await writeFile(searchPath, `${JSON.stringify(search, null, 2)}\n`);
  await writeFile(path.join(kbRoot, "项目总览.md"), "# 项目总览\n\nPublished from the selected worktree.\n");
  return root;
}

test("root mode is fail-closed for non-worktree, subdirectory, stale, and unsafe artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "preview-root-"));
  await mkdir(path.join(root, ".understand-code/knowledge-base"), { recursive: true });
  await writeFile(path.join(root, ".understand-code/knowledge-graph.json"), "{}\n");
  await expectExit(["--root", root, "--port", "0", "--no-open"], /not_ready/u);

  const published = await createPublishedRoot();
  await expectExit(["--root", path.join(published, "src"), "--no-open"], /canonical Git worktree root/u);

  const valid = start(["--root", published, "--port", "0", "--no-open"]);
  try {
    const validInfo = await valid.ready;
    assert.equal(validInfo.mode, "root");
    const validBase = new URL(validInfo.url);
    for (const endpoint of [
      "/knowledge-graph.json",
      "/knowledge-base/wiki-index.json",
      "/knowledge-base/search-index.json",
      "/knowledge-base/项目总览.md",
    ]) {
      const response = await fetch(`${validBase.origin}${endpoint}?token=${validInfo.token}`);
      assert.equal(response.status, 200);
      assert.doesNotMatch(await response.text(), new RegExp(published.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    }
    await writeFile(path.join(published, "src/app.ts"), "export function main() { return 'dirty'; }\n");
    const committedSource = await fetch(`${validBase.origin}/file-content.json?path=src%2Fapp.ts&token=${validInfo.token}`);
    assert.equal(committedSource.status, 200);
    const committedContent = (await committedSource.json()).content;
    assert.match(committedContent, /return 'ready'/u);
    assert.doesNotMatch(committedContent, new RegExp(`${published.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/private`, "u"));
    assert.match(committedContent, new RegExp(`${published.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}-sibling`, "u"));
  } finally {
    await stop(valid.child);
  }

  await writeFile(path.join(published, "src/next.ts"), "export const next = true;\n");
  await git(published, ["add", "src/next.ts"]);
  await git(published, ["commit", "-q", "-m", "make published graph stale"]);
  await expectExit(["--root", published, "--no-open"], /published graph is stale/u);

  const staleWikiRoot = await createPublishedRoot();
  const staleWikiPath = path.join(staleWikiRoot, ".understand-code/knowledge-base/wiki-index.json");
  const staleWiki = JSON.parse(await readFile(staleWikiPath, "utf8"));
  staleWiki.source.gitCommitHash = "stale-wiki-commit";
  await writeFile(staleWikiPath, `${JSON.stringify(staleWiki, null, 2)}\n`);
  await expectExit(["--root", staleWikiRoot, "--no-open"], /published Wiki is stale/u);

  const staleMetaRoot = await createPublishedRoot();
  const staleMetaPath = path.join(staleMetaRoot, ".understand-code/meta.json");
  const staleMeta = JSON.parse(await readFile(staleMetaPath, "utf8"));
  staleMeta.gitCommitHash = "stale-meta-commit";
  await writeFile(staleMetaPath, `${JSON.stringify(staleMeta, null, 2)}\n`);
  await expectExit(["--root", staleMetaRoot, "--no-open"], /published metadata is stale/u);

  const staleDigestRoot = await createPublishedRoot();
  const staleDigestWikiPath = path.join(staleDigestRoot, ".understand-code/knowledge-base/wiki-index.json");
  const staleDigestWiki = JSON.parse(await readFile(staleDigestWikiPath, "utf8"));
  staleDigestWiki.source.graphDigest = "0".repeat(64);
  await writeFile(staleDigestWikiPath, `${JSON.stringify(staleDigestWiki, null, 2)}\n`);
  await expectExit(["--root", staleDigestRoot, "--no-open"], /does not bind the current knowledge graph/u);

  const wrongRootWiki = await createPublishedRoot();
  const wrongRootWikiPath = path.join(wrongRootWiki, ".understand-code/knowledge-base/wiki-index.json");
  const wrongRootIndex = JSON.parse(await readFile(wrongRootWikiPath, "utf8"));
  wrongRootIndex.source.sourceRootIdentity = "/different/worktree";
  await writeFile(wrongRootWikiPath, `${JSON.stringify(wrongRootIndex, null, 2)}\n`);
  await expectExit(["--root", wrongRootWiki, "--no-open"], /bound to a different source root/u);

  const corruptSearchRoot = await createPublishedRoot();
  await writeFile(path.join(corruptSearchRoot, ".understand-code/knowledge-base/search-index.json"), "{not-json\n");
  await expectExit(["--root", corruptSearchRoot, "--no-open"], /search-index.json failed V2 validation/u);

  const invalidSearchRoot = await createPublishedRoot();
  const invalidSearchPath = path.join(invalidSearchRoot, ".understand-code/knowledge-base/search-index.json");
  const invalidSearch = JSON.parse(await readFile(invalidSearchPath, "utf8"));
  invalidSearch.records[0].kind = "other";
  await writeFile(invalidSearchPath, `${JSON.stringify(invalidSearch, null, 2)}\n`);
  await expectExit(["--root", invalidSearchRoot, "--no-open"], /search-index.json failed V2 validation/u);

  const mismatchedSearchRoot = await createPublishedRoot();
  const mismatchedSearchPath = path.join(mismatchedSearchRoot, ".understand-code/knowledge-base/search-index.json");
  const mismatchedSearch = JSON.parse(await readFile(mismatchedSearchPath, "utf8"));
  mismatchedSearch.records[0].role = "reference";
  await writeFile(mismatchedSearchPath, `${JSON.stringify(mismatchedSearch, null, 2)}\n`);
  await expectExit(["--root", mismatchedSearchRoot, "--no-open"], /search-index.json failed V2 validation/u);

  const incompleteSearchRoot = await createPublishedRoot();
  const incompleteSearchPath = path.join(incompleteSearchRoot, ".understand-code/knowledge-base/search-index.json");
  const incompleteSearch = JSON.parse(await readFile(incompleteSearchPath, "utf8"));
  incompleteSearch.records = incompleteSearch.records.filter((record) => !(record.kind === "page" && record.pageId === "page:overview"));
  await writeFile(incompleteSearchPath, `${JSON.stringify(incompleteSearch, null, 2)}\n`);
  await expectExit(["--root", incompleteSearchRoot, "--no-open"], /search-index.json failed V2 validation/u);

  const mismatchedWikiGraphRoot = await createPublishedRoot();
  const mismatchedWikiGraphPath = path.join(mismatchedWikiGraphRoot, ".understand-code/knowledge-base/wiki-index.json");
  const mismatchedWikiGraph = JSON.parse(await readFile(mismatchedWikiGraphPath, "utf8"));
  const originalNodeId = mismatchedWikiGraph.nodeDocumentation[0].nodeId;
  const missingNodeId = "missing:graph-node";
  mismatchedWikiGraph.nodeDocumentation[0].nodeId = missingNodeId;
  for (const page of mismatchedWikiGraph.pages) {
    page.directNodeIds = page.directNodeIds.map((nodeId) => nodeId === originalNodeId ? missingNodeId : nodeId);
    page.contextNodeIds = page.contextNodeIds.map((nodeId) => nodeId === originalNodeId ? missingNodeId : nodeId);
  }
  for (const evidence of mismatchedWikiGraph.evidence) {
    evidence.nodeIds = evidence.nodeIds.map((nodeId) => nodeId === originalNodeId ? missingNodeId : nodeId);
  }
  await writeFile(mismatchedWikiGraphPath, `${JSON.stringify(mismatchedWikiGraph, null, 2)}\n`);
  await expectExit(["--root", mismatchedWikiGraphRoot, "--no-open"], /Wiki references do not match/u);

  const corruptWikiRoot = await createPublishedRoot();
  await writeFile(path.join(corruptWikiRoot, ".understand-code/knowledge-base/wiki-index.json"), "{not-json\n");
  await expectExit(["--root", corruptWikiRoot, "--no-open"], /wiki-index.json failed V2 validation/u);

  const invalidWikiRoot = await createPublishedRoot();
  const invalidWikiPath = path.join(invalidWikiRoot, ".understand-code/knowledge-base/wiki-index.json");
  const invalidWiki = JSON.parse(await readFile(invalidWikiPath, "utf8"));
  delete invalidWiki.pages[0].title;
  await writeFile(invalidWikiPath, `${JSON.stringify(invalidWiki, null, 2)}\n`);
  await expectExit(["--root", invalidWikiRoot, "--no-open"], /wiki-index.json failed V2 validation/u);

  const invalidGraphRoot = await createPublishedRoot();
  const invalidGraphPath = path.join(invalidGraphRoot, ".understand-code/knowledge-graph.json");
  const invalidGraph = JSON.parse(await readFile(invalidGraphPath, "utf8"));
  invalidGraph.project.gitCommitHash = 42;
  await writeFile(invalidGraphPath, `${JSON.stringify(invalidGraph, null, 2)}\n`);
  await expectExit(["--root", invalidGraphRoot, "--no-open"], /knowledge-graph.json failed structural validation/u);

  const safe = await createPublishedRoot();
  const outside = await mkdtemp(path.join(tmpdir(), "preview-outside-"));
  await writeFile(path.join(outside, "external.md"), "must not be served\n");
  const kbRoot = path.join(safe, ".understand-code/knowledge-base");
  await symlink(path.join(outside, "external.md"), path.join(kbRoot, "escape.md"));
  const wikiPath = path.join(kbRoot, "wiki-index.json");
  const wiki = JSON.parse(await readFile(wikiPath, "utf8"));
  wiki.pages.push({ ...wiki.pages[0], id: "page:escape", title: "Escape", markdownPath: "knowledge-base/escape.md", route: { order: 9, stage: "purpose" } });
  wiki.nodeDocumentation.find((record) => record.nodeId === "module:knowledge").directPageIds.push("page:escape");
  await writeFile(wikiPath, `${JSON.stringify(wiki, null, 2)}\n`);
  const searchPath = path.join(kbRoot, "search-index.json");
  const search = JSON.parse(await readFile(searchPath, "utf8"));
  search.records.push({ ...search.records.find((record) => record.kind === "page" && record.pageId === "page:overview"), id: "search:escape", title: "Escape", pageId: "page:escape" });
  await writeFile(searchPath, `${JSON.stringify(search, null, 2)}\n`);
  await expectExit(["--root", safe, "--no-open"], /missing or unsafe Markdown/u);

  const symlinkedGraphRoot = await createPublishedRoot();
  const symlinkOutside = await mkdtemp(path.join(tmpdir(), "preview-graph-outside-"));
  const symlinkGraphPath = path.join(symlinkedGraphRoot, ".understand-code/knowledge-graph.json");
  const copiedGraph = await readFile(symlinkGraphPath);
  const outsideGraph = path.join(symlinkOutside, "knowledge-graph.json");
  await writeFile(outsideGraph, copiedGraph);
  await rm(symlinkGraphPath);
  await symlink(outsideGraph, symlinkGraphPath);
  await expectExit(["--root", symlinkedGraphRoot, "--no-open"], /must not be symbolic links/u);
});
