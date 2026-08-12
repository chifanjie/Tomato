import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

import { ArtifactStore, sha256CanonicalJson } from "../../artifact-store/dist/index.js";
import {
  BuildTaskBriefOutputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefOutputV1Schema,
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
} from "../../contracts/dist/index.js";
import { buildRepoPulse, getRepositorySnapshotDetailed } from "../../repository-state/dist/index.js";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(new URL("..", import.meta.url).pathname);
const PROCESS_TIMEOUT_MS = 15_000;

function withTimeout(promise, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function waitForExit(child, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve([child.exitCode, child.signalCode]);
  }
  return withTimeout(new Promise((resolve, reject) => {
    const onError = (error) => {
      child.off("exit", onExit);
      reject(error);
    };
    const onExit = (code, signal) => {
      child.off("error", onError);
      resolve([code, signal]);
    };
    child.once("error", onError);
    child.once("exit", onExit);
  }), label, timeoutMs);
}

async function stopChild(child, label) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (child.stdin?.writable) child.stdin.end();
  child.kill("SIGTERM");
  try {
    await waitForExit(child, `${label} shutdown`, 2_000);
  } catch {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await waitForExit(child, `${label} forced shutdown`, 2_000);
  }
}

function startPreview(executable, cwd, args = ["--demo", "--port", "0", "--no-open"]) {
  const child = spawn(executable, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = withTimeout(new Promise((resolve, reject) => {
    const output = [];
    const errors = [];
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => errors.push(chunk));
    createInterface({ input: child.stdout }).on("line", (line) => {
      output.push(line);
      if (!line.startsWith("PREVIEW_READY ")) return;
      try {
        resolve(JSON.parse(line.slice("PREVIEW_READY ".length)));
      } catch (error) {
        reject(error);
      }
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (output.every((line) => !line.startsWith("PREVIEW_READY "))) {
        reject(new Error(`preview exited before ready (code=${code}, signal=${signal}): ${errors.join("") || output.join("\n")}`));
      }
    });
  }), "cold Preview ready");
  return { child, ready };
}

function writeMessage(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function collectMessages(child) {
  const messages = [];
  const stderr = [];
  const waiters = [];
  let terminalError = null;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  createInterface({ input: child.stdout }).on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      terminalError = new Error(`MCP emitted invalid JSON: ${line}`, { cause: error });
      for (const waiter of waiters.splice(0)) waiter.reject(terminalError);
      return;
    }
    messages.push(message);
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(message)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  });
  child.once("error", (error) => {
    terminalError = error;
    for (const waiter of waiters.splice(0)) waiter.reject(error);
  });
  child.once("exit", (code, signal) => {
    terminalError = new Error(`MCP exited before the expected message (code=${code}, signal=${signal})`);
    for (const waiter of waiters.splice(0)) waiter.reject(terminalError);
  });
  child.stdin.once("error", (error) => {
    terminalError = error;
    for (const waiter of waiters.splice(0)) waiter.reject(error);
  });
  return {
    stderr,
    waitFor(predicate, label = "MCP response") {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      if (terminalError) return Promise.reject(terminalError);
      return withTimeout(new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve: (message) => {
            clearTimeout(waiter.timer);
            resolve(message);
          },
          reject: (error) => {
            clearTimeout(waiter.timer);
            reject(error);
          },
          timer: undefined,
        };
        waiter.timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index !== -1) waiters.splice(index, 1);
          reject(new Error(`${label} timed out after ${PROCESS_TIMEOUT_MS}ms`));
        }, PROCESS_TIMEOUT_MS);
        waiters.push(waiter);
      }), label, PROCESS_TIMEOUT_MS + 100);
    },
  };
}

async function git(root, args) {
  return execFileAsync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Preview Cold Test",
      GIT_AUTHOR_EMAIL: "preview@example.invalid",
      GIT_COMMITTER_NAME: "Preview Cold Test",
      GIT_COMMITTER_EMAIL: "preview@example.invalid",
    },
  });
}

async function createMcpRoot() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "preview-mcp-root-")));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src/task.ts"), "export function task() { return true; }\n");
  await git(root, ["init", "-q"]);
  await git(root, ["add", "src/task.ts"]);
  await git(root, ["commit", "-q", "-m", "preview MCP fixture"]);
  const capture = await getRepositorySnapshotDetailed(root, {
    now: () => new Date("2026-08-12T00:00:00.000Z"),
  });
  assert.equal(capture.snapshot.captureStatus, "complete");
  const store = await ArtifactStore.open(root, {
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    producerVersion: "0.1.0",
    clock: () => new Date("2026-08-12T00:00:00.000Z"),
  });
  await store.initialize();
  const graph = {
    version: "1",
    project: {
      name: "preview-mcp-fixture",
      languages: ["TypeScript"], frameworks: [], description: "Cold MCP fixture",
      analyzedAt: "2026-08-12T00:00:00.000Z", gitCommitHash: capture.snapshot.headCommit,
    },
    nodes: [{
      id: "function:task", type: "function", name: "task", filePath: "src/task.ts",
      lineRange: [1, 1], summary: "Returns task state.", tags: ["task"], complexity: "simple",
    }],
    edges: [], layers: [], tour: [],
  };
  await writeFile(path.join(root, ".understand-code/knowledge-graph.json"), `${JSON.stringify(graph)}\n`);
  const pulse = buildRepoPulse({
    snapshot: capture.snapshot,
    git: capture.git,
    artifacts: { graph: "fresh", wiki: "missing", evidence: "fresh", diff: "missing", task: "fresh" },
    completeness: {
      parser: { status: "complete", coverage: 1, reasons: [] },
      callGraph: { status: "complete", coverage: 1, reasons: [] },
    },
    evaluatedAt: "2026-08-12T00:00:00.000Z",
  });
  await store.persistArtifact(RepositorySnapshotArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repository_snapshot",
    artifactId: `artifact:repository-snapshot:${capture.snapshot.snapshotId}`,
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    sourceSnapshotId: capture.snapshot.snapshotId,
    revision: 0,
    producerVersion: "0.1.0",
    createdAt: capture.snapshot.createdAt,
    contentDigest: sha256CanonicalJson(capture.snapshot),
    payload: capture.snapshot,
  }));
  await store.persistArtifact(RepoPulseArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repo_pulse",
    artifactId: `artifact:repo-pulse:${capture.snapshot.snapshotId}`,
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    sourceSnapshotId: capture.snapshot.snapshotId,
    revision: 0,
    producerVersion: "0.1.0",
    createdAt: pulse.evaluatedAt,
    contentDigest: sha256CanonicalJson(pulse),
    payload: pulse,
  }));
  return root;
}

async function createPublishedPreviewRoot(installedPackageRoot) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "preview-cold-published-root-")));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src/app.ts"), "export function main() { return 'ready'; }\n");
  await git(root, ["init", "-q"]);
  await git(root, ["add", "src/app.ts"]);
  await git(root, ["commit", "-q", "-m", "cold Preview root fixture"]);
  await cp(path.join(installedPackageRoot, "dist/demo/.understand-code"), path.join(root, ".understand-code"), { recursive: true });
  const head = (await git(root, ["rev-parse", "HEAD"])).stdout.trim();
  const graphPath = path.join(root, ".understand-code/knowledge-graph.json");
  const graph = JSON.parse(await readFile(graphPath, "utf8"));
  graph.project.gitCommitHash = head;
  await writeFile(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
  const graphDigest = createHash("sha256").update(JSON.stringify(graph)).digest("hex");
  const metaPath = path.join(root, ".understand-code/meta.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  meta.gitCommitHash = head;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  const wikiPath = path.join(root, ".understand-code/knowledge-base/wiki-index.json");
  const wiki = JSON.parse(await readFile(wikiPath, "utf8"));
  wiki.source.sourceRootIdentity = root;
  wiki.source.gitCommitHash = head;
  wiki.source.graphDigest = graphDigest;
  await writeFile(wikiPath, `${JSON.stringify(wiki, null, 2)}\n`);
  return root;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("cold packed Preview installs outside the monorepo with both usable bins", async () => {
  const packDirectory = await mkdtemp(path.join(tmpdir(), "preview-pack-"));
  const installDirectory = await mkdtemp(path.join(tmpdir(), "preview-install-"));
  const mcpRoot = await createMcpRoot();
  let publishedRoot = null;
  let previewChild = null;
  let mcpChild = null;
  try {
    const suppliedTarball = process.env.UNDERSTAND_CODE_PREVIEW_TARBALL;
    if (suppliedTarball === undefined) {
      await execFileAsync("npm", ["pack", ".", "--ignore-scripts", "--pack-destination", packDirectory], { cwd: packageRoot, encoding: "utf8" });
    }
    const packedTarballs = suppliedTarball === undefined
      ? (await readdir(packDirectory)).filter((name) => name.endsWith(".tgz"))
      : [];
    if (suppliedTarball === undefined) assert.equal(packedTarballs.length, 1);
    const tarballPath = suppliedTarball === undefined
      ? path.join(packDirectory, packedTarballs[0] ?? "")
      : path.resolve(suppliedTarball);
    const tarball = path.basename(tarballPath);
    assert.ok(tarball);
    const tarballBefore = await readFile(tarballPath);
    await execFileAsync("npm", ["install", "--global", "--prefix", installDirectory, "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarballPath], { cwd: installDirectory, encoding: "utf8" });
    const globalBinRoot = process.platform === "win32" ? installDirectory : path.join(installDirectory, "bin");
    const globalModulesRoot = process.platform === "win32" ? path.join(installDirectory, "node_modules") : path.join(installDirectory, "lib/node_modules");
    const installedPackageRoot = path.join(globalModulesRoot, "@understand-code/preview");
    const previewBin = path.join(globalBinRoot, "understand-code-preview");
    const mcpBin = path.join(globalBinRoot, "understand-code");
    const [previewVersion, mcpVersion] = await Promise.all([
      execFileAsync(previewBin, ["--version"], { cwd: installDirectory, encoding: "utf8" }),
      execFileAsync(mcpBin, ["--version"], { cwd: installDirectory, encoding: "utf8" }),
    ]);
    assert.equal(previewVersion.stdout, "0.1.0-preview.1\n");
    assert.equal(mcpVersion.stdout, "0.1.0\n");
    const help = await execFileAsync(previewBin, ["--help"], { cwd: installDirectory, encoding: "utf8" });
    assert.match(help.stdout, /understand-code-preview --demo/u);
    await assert.rejects(
      execFileAsync(previewBin, ["--unknown"], { cwd: installDirectory, encoding: "utf8" }),
      (error) => error && error.code === 2 && error.stderr === "preview_error unknown option: --unknown\n",
    );
    const manifest = JSON.parse(await readFile(path.join(installedPackageRoot, "package.json"), "utf8"));
    assert.deepEqual(manifest.dependencies ?? {}, {});
    const bundle = await readFile(path.join(installedPackageRoot, "dist/understand-code.mjs"), "utf8");
    assert.doesNotMatch(bundle, /workspace:\*/u);
    assert.doesNotMatch(bundle, new RegExp(packageRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    const installedPreviewBundle = await readFile(path.join(installedPackageRoot, "dist/bin.mjs"), "utf8");
    assert.doesNotMatch(installedPreviewBundle, new RegExp(packageRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    const preview = startPreview(previewBin, installDirectory);
    previewChild = preview.child;
    const ready = await preview.ready;
    const previewUrl = new URL(ready.url);
    assert.equal(ready.mode, "demo");
    assert.equal(ready.wiki, "ready");
    const index = await fetch(previewUrl);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /<div id="root"><\/div>/u);
    const graph = await fetch(`${previewUrl.origin}/knowledge-graph.json?token=${encodeURIComponent(ready.token)}`);
    assert.equal(graph.status, 200);
    assert.equal((await graph.json()).project.name, "Preview 示例项目");
    await stopChild(previewChild, "cold Preview");
    previewChild = null;

    publishedRoot = await createPublishedPreviewRoot(installedPackageRoot);
    const rootPreview = startPreview(previewBin, installDirectory, ["--root", publishedRoot, "--port", "0", "--no-open"]);
    previewChild = rootPreview.child;
    const rootReady = await rootPreview.ready;
    assert.equal(rootReady.mode, "root");
    assert.equal(rootReady.wiki, "ready");
    const rootUrl = new URL(rootReady.url);
    const [rootGraph, rootWiki] = await Promise.all([
      fetch(`${rootUrl.origin}/knowledge-graph.json?token=${encodeURIComponent(rootReady.token)}`),
      fetch(`${rootUrl.origin}/knowledge-base/wiki-index.json?token=${encodeURIComponent(rootReady.token)}`),
    ]);
    assert.equal(rootGraph.status, 200);
    assert.equal(rootWiki.status, 200);
    assert.equal((await rootWiki.json()).version, 2);
    await stopChild(previewChild, "cold root Preview");
    previewChild = null;

    const sourceBefore = await readFile(path.join(mcpRoot, "src/task.ts"));
    const indexBefore = digest(await readFile(path.join(mcpRoot, ".git/index")));
    const mcp = spawn(mcpBin, ["mcp", "--stdio", "--root", mcpRoot], {
      cwd: installDirectory,
      env: { PATH: process.env.PATH, GIT_DIR: path.join(mcpRoot, "ambient-git-dir-must-not-be-authority") },
      stdio: ["pipe", "pipe", "pipe"],
    });
    mcpChild = mcp;
    const output = collectMessages(mcp);
    writeMessage(mcp, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "preview-cold", version: "1.0.0" } },
    });
    writeMessage(mcp, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    writeMessage(mcp, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    writeMessage(mcp, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_repo_pulse", arguments: {} } });
    writeMessage(mcp, {
      jsonrpc: "2.0", id: 4, method: "tools/call",
      params: {
        name: "build_task_brief",
        arguments: {
          task: "Prepare a safe change to the task function.", expectedRevision: 0,
          idempotencyKey: "preview-cold-brief", actor: "agent:preview-cold", scope: ["src/task.ts"],
        },
      },
    });
    const listed = await output.waitFor((message) => message.id === 2, "MCP tools/list response");
    assert.deepEqual(listed.result.tools.map((tool) => tool.name), ["get_repo_pulse", "build_task_brief", "get_task_brief"]);
    GetRepoPulseOutputV1Schema.parse((await output.waitFor((message) => message.id === 3, "MCP get_repo_pulse response")).result);
    const built = BuildTaskBriefOutputV1Schema.parse((await output.waitFor((message) => message.id === 4, "MCP build_task_brief response")).result);
    writeMessage(mcp, {
      jsonrpc: "2.0", id: 5, method: "tools/call",
      params: { name: "get_task_brief", arguments: { taskId: built.structuredContent.result.task.taskId, section: "summary" } },
    });
    GetTaskBriefOutputV1Schema.parse((await output.waitFor((message) => message.id === 5, "MCP get_task_brief response")).result);
    mcp.stdin.end();
    assert.equal((await waitForExit(mcp, "MCP clean exit"))[0], 0);
    mcpChild = null;
    assert.equal(output.stderr.join(""), "");
    assert.deepEqual(await readFile(path.join(mcpRoot, "src/task.ts")), sourceBefore);
    assert.equal(digest(await readFile(path.join(mcpRoot, ".git/index"))), indexBefore);
    assert.deepEqual(await readFile(tarballPath), tarballBefore);
  } finally {
    await Promise.allSettled([
      stopChild(previewChild, "cold Preview"),
      stopChild(mcpChild, "cold MCP"),
    ]);
    await Promise.all([
      rm(packDirectory, { recursive: true, force: true }),
      rm(installDirectory, { recursive: true, force: true }),
      rm(mcpRoot, { recursive: true, force: true }),
      ...(publishedRoot === null ? [] : [rm(publishedRoot, { recursive: true, force: true })]),
    ]);
  }
});
