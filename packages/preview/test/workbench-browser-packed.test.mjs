import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";

import {
  RepoPulseArtifactV1Schema,
  TaskBriefArtifactV1Schema,
  TaskManifestArtifactV1Schema,
  canonicalizeJson,
} from "../../contracts/dist/index.js";
import { launchBrowser, resolveBrowserExecutable } from "./browser-harness.mjs";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = path.resolve(packageRoot, "../..");
const PROCESS_TIMEOUT_MS = 60_000;
const EXTERNAL_TIMEOUT_MS = 120_000;
const REQUIRE_REAL_BROWSER = process.env.UNDERSTAND_CODE_REQUIRE_REAL_BROWSER === "1";
const DEMO_TASK_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

const LEGACY_TASK_REPOSITORY_CANARY = "repository:private-legacy-task-canary";
const LEGACY_TASK_WORKTREE_CANARY = "worktree:private-legacy-task-canary";
const LEGACY_TASK_SNAPSHOT_CANARY = "snapshot:private-legacy-task-canary";
const LEGACY_TASK_PATH_CANARY = "private/legacy-task-path-canary.ts";
const LEGACY_PULSE_BRANCH_CANARY = "private/legacy-pulse-branch-canary";
const LEGACY_PULSE_OID_CANARY = "feedface".repeat(5);
const LEGACY_PULSE_DIGEST_CANARY = `sha256:${"deadbeef".repeat(8)}`;
const LEGACY_PULSE_FREE_TEXT_CANARY =
  "legacy Pulse private free-text canary must remain owner-only";
const LEGACY_PULSE_CANARIES = Object.freeze([
  LEGACY_TASK_REPOSITORY_CANARY,
  LEGACY_TASK_WORKTREE_CANARY,
  LEGACY_TASK_SNAPSHOT_CANARY,
  LEGACY_TASK_PATH_CANARY,
  LEGACY_PULSE_BRANCH_CANARY,
  LEGACY_PULSE_OID_CANARY,
  LEGACY_PULSE_DIGEST_CANARY,
  LEGACY_PULSE_FREE_TEXT_CANARY,
]);

const STRONG_REPOSITORY_ID = `repo-hmac-${"1".repeat(64)}`;
const STRONG_WORKTREE_ID = `worktree-hmac-${"2".repeat(64)}`;
const STRONG_ROOT_IDENTITY = `root-hmac-${"3".repeat(64)}`;
const STRONG_EVALUATED_SNAPSHOT_ID = `snapshot-${"4".repeat(64)}`;
const STRONG_TASK_BASELINE_SNAPSHOT_ID = `snapshot-${"5".repeat(64)}`;
const STRONG_PULSE_BASELINE_SNAPSHOT_CANARY = `snapshot-${"6".repeat(64)}`;
const STRONG_PULSE_BRANCH_CANARY = "private/strong-pulse-branch-canary";
const STRONG_PULSE_OID_CANARY = "c0decafe".repeat(5);
const STRONG_PULSE_DIGEST_CANARY = `sha256:${"b".repeat(64)}`;
const STRONG_PULSE_TOKEN_CANARY = `hmac-sha256:${"c".repeat(64)}`;
const STRONG_PULSE_CANARIES = Object.freeze([
  STRONG_REPOSITORY_ID,
  STRONG_WORKTREE_ID,
  STRONG_ROOT_IDENTITY,
  STRONG_EVALUATED_SNAPSHOT_ID,
  STRONG_TASK_BASELINE_SNAPSHOT_ID,
  STRONG_PULSE_BRANCH_CANARY,
  STRONG_PULSE_OID_CANARY,
  STRONG_PULSE_DIGEST_CANARY,
  STRONG_PULSE_TOKEN_CANARY,
  STRONG_PULSE_BASELINE_SNAPSHOT_CANARY,
]);

const CANDIDATE_SCRIPT = "packages/preview/scripts/alpha-candidate.mjs";
const CANDIDATE_MANIFEST = "understand-code-alpha-candidate.json";
const CANDIDATE_SCHEMA = "understand-code-alpha-candidate-v1.schema.json";
const CANDIDATE_CHECKSUMS = "SHA256SUMS";
const SURFACE_CANDIDATE_OVERLAY_FILES = Object.freeze([
  "packages/cli/scripts/build-bundle.mjs",
  "packages/cli/src/argv.ts",
  "packages/cli/src/bin.ts",
  "packages/cli/src/mcp/server.ts",
  "packages/cli/test/argv.test.ts",
  "packages/cli/test/mcp.integration.test.ts",
  "packages/dashboard/src/App.tsx",
  "packages/dashboard/src/components/taskFirst/KnowledgeCandidateReview.tsx",
  "packages/dashboard/src/components/taskFirst/TaskFirstWorkbench.tsx",
  "packages/dashboard/src/components/taskFirst/__tests__/KnowledgeCandidateReview.test.tsx",
  "packages/dashboard/src/components/taskFirst/__tests__/route.test.ts",
  "packages/dashboard/src/components/taskFirst/route.ts",
  "packages/dashboard/src/workbench/__tests__/publishedKnowledge.test.ts",
  "packages/dashboard/src/workbench/__tests__/taskContextLoader.test.ts",
  "packages/dashboard/src/workbench/publishedKnowledge.ts",
  "packages/dashboard/src/workbench/taskContextLoader.ts",
  "packages/installation-lifecycle/src/index.ts",
  "packages/installation-lifecycle/test/installation-lifecycle.test.ts",
  "packages/installation-lifecycle/test/lifecycle-lock.test.ts",
  "packages/preview/README.md",
  "packages/preview/scripts/alpha-candidate.mjs",
  "packages/preview/test/alpha-candidate.test.mjs",
  "packages/preview/test/cold-packed.test.mjs",
  "packages/preview/test/workbench-browser-packed.test.mjs",
]);

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function contentDigest(bytes) {
  return `sha256:${digest(bytes)}`;
}

function payloadContentDigest(payload) {
  return contentDigest(Buffer.from(canonicalizeJson(payload), "utf8"));
}

function packedRegularFileCount(bytes) {
  const archive = gunzipSync(bytes);
  let offset = 0;
  let count = 0;
  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const sizeText = header
      .subarray(124, 136)
      .toString("ascii")
      .replaceAll("\0", "")
      .trim();
    assert.match(sizeText, /^[0-7]+$/u, "packed tar size must be portable octal");
    const size = Number.parseInt(sizeText, 8);
    const type = header[156] === 0 ? "0" : String.fromCharCode(header[156]);
    if (type === "0") count += 1;
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return count;
}

function execBounded(command, args, options = {}) {
  return execFileAsync(command, args, {
    ...options,
    timeout: options.timeout ?? EXTERNAL_TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: 8 * 1024 * 1024,
  });
}

function withTimeout(promise, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

function waitForExit(child, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve([child.exitCode, child.signalCode]);
  }
  return withTimeout(new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve([code, signal]));
  }), label, timeoutMs);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (child.stdin?.writable) child.stdin.end();
  try {
    await waitForExit(child, "Preview clean exit", 3_000);
    return;
  } catch {
    child.kill("SIGTERM");
  }
  try {
    await waitForExit(child, "Preview graceful stop", 3_000);
  } catch {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await waitForExit(child, "Preview forced stop", 3_000);
  }
}

function sanitizedGitEnvironment() {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
    ),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_COUNT: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
  };
}

async function candidateGit(cwd, args, timeout = EXTERNAL_TIMEOUT_MS) {
  return execBounded(
    "git",
    [
      "--no-pager",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "core.fsmonitor=false",
      ...args,
    ],
    {
      cwd,
      env: sanitizedGitEnvironment(),
      encoding: "utf8",
      timeout,
    },
  );
}

async function candidateChangedPaths(cwd) {
  const output = (await candidateGit(
    cwd,
    ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
  )).stdout;
  const paths = output.split("\0").filter(Boolean).map((entry) => {
    const statusCode = entry.slice(0, 2);
    assert.match(
      statusCode,
      /^(?: M|\?\?)$/u,
      `candidate overlay must only contain copied modifications or new files: ${entry}`,
    );
    assert.equal(entry[2], " ", `invalid porcelain status entry: ${entry}`);
    return entry.slice(3);
  });
  paths.sort();
  return paths;
}

async function copyCandidateOverlay(cloneRoot) {
  await Promise.all(SURFACE_CANDIDATE_OVERLAY_FILES.map(async (relativePath) => {
    const sourcePath = path.join(sourceRoot, relativePath);
    const destinationPath = path.join(cloneRoot, relativePath);
    const sourceStat = await stat(sourcePath);
    assert.equal(sourceStat.isFile(), true, `candidate overlay must be a regular file: ${relativePath}`);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await cp(sourcePath, destinationPath, { force: true });
  }));
}

async function commitCandidateSource(cwd, expectedPaths) {
  await candidateGit(cwd, ["add", "--", ...expectedPaths]);
  const stagedOutput = (await candidateGit(
    cwd,
    ["diff", "--cached", "--name-only"],
  )).stdout.trim();
  const stagedPaths = stagedOutput === "" ? [] : stagedOutput.split("\n").sort();
  assert.deepEqual(
    stagedPaths,
    expectedPaths,
    "the candidate commit must stage the exact reviewed Surface closure",
  );
  await candidateGit(cwd, [
    "-c",
    "user.name=Understand Code Surface Candidate",
    "-c",
    "user.email=surface-candidate@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "bind candidate to reviewed Repository Surface closure",
  ]);
  return (await candidateGit(cwd, ["rev-parse", "HEAD"])).stdout.trim();
}

async function runCandidate(scriptPath, operation, candidateRoot, cwd, environment) {
  const flag = operation === "assemble" ? "--output" : "--candidate";
  const result = await execBounded(
    process.execPath,
    [scriptPath, operation, flag, candidateRoot],
    {
      cwd,
      env: environment,
      encoding: "utf8",
      timeout: 15 * 60 * 1000,
    },
  );
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    operation,
    disposition: "unsigned_alpha_candidate",
    releaseReady: false,
  });
}

async function readCandidate(candidateRoot, expectedVersion, sourceCommit, sourceTree) {
  const names = (await readdir(candidateRoot)).sort();
  const tarballs = names.filter((name) => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1, "the verified candidate must contain exactly one tgz");
  assert.deepEqual(
    names,
    [CANDIDATE_CHECKSUMS, CANDIDATE_MANIFEST, CANDIDATE_SCHEMA, tarballs[0]].sort(),
    "the candidate directory must contain only its audited subject and metadata",
  );
  const tarballPath = path.join(candidateRoot, tarballs[0]);
  const [tarballBytes, manifestBytes, schemaBytes, checksumBytes] = await Promise.all([
    readFile(tarballPath),
    readFile(path.join(candidateRoot, CANDIDATE_MANIFEST)),
    readFile(path.join(candidateRoot, CANDIDATE_SCHEMA)),
    readFile(path.join(candidateRoot, CANDIDATE_CHECKSUMS)),
  ]);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.deepEqual(Object.keys(manifest).sort(), [
    "build",
    "disposition",
    "embeddedReleaseManifest",
    "gates",
    "limitations",
    "package",
    "releaseReady",
    "schemaVersion",
    "source",
    "subject",
  ]);
  assert.deepEqual(manifest.package, {
    name: "@understand-code/preview",
    version: expectedVersion,
  });
  assert.deepEqual(
    {
      clean: manifest.source.clean,
      commit: manifest.source.commit,
      tree: manifest.source.tree,
    },
    { clean: true, commit: sourceCommit, tree: sourceTree },
    "candidate provenance must bind the clean ephemeral overlay commit and tree",
  );
  assert.deepEqual(manifest.gates, {
    coldPacked: "passed",
    checksum: "passed",
  });
  assert.deepEqual(manifest.subject, {
    file: tarballs[0],
    mediaType: "application/vnd.npm.package+gzip",
    bytes: tarballBytes.byteLength,
    sha256: contentDigest(tarballBytes),
  });
  assert.equal(manifest.releaseReady, false);
  assert.equal(manifest.disposition, "unsigned_alpha_candidate");
  assert.equal(
    manifest.build.nativeTuple,
    `${manifest.build.platform}-${manifest.build.arch}`,
  );
  const expectedChecksums = [
    [CANDIDATE_MANIFEST, manifestBytes],
    [CANDIDATE_SCHEMA, schemaBytes],
    [tarballs[0], tarballBytes],
  ].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(
    ([name, bytes]) => `${digest(bytes)}  ${name}`,
  );
  assert.deepEqual(
    checksumBytes.toString("utf8").trimEnd().split("\n"),
    expectedChecksums,
  );
  return {
    fileCount: packedRegularFileCount(tarballBytes),
    manifest,
    tarballBytes,
    tarballPath,
  };
}

async function createSurfaceCandidate() {
  const parent = await realpath(
    await mkdtemp(path.join(tmpdir(), "uc-surface-candidate-")),
  );
  try {
    const cloneRoot = path.join(parent, "source");
    const candidateRoot = path.join(parent, "candidate");
    const expectedPaths = [...SURFACE_CANDIDATE_OVERLAY_FILES].sort();
    assert.equal(
      new Set(expectedPaths).size,
      expectedPaths.length,
      "the Surface candidate allowlist must not contain duplicate paths",
    );
    const sourceHead = (await candidateGit(
      sourceRoot,
      ["rev-parse", "HEAD^{commit}"],
    )).stdout.trim();
    await candidateGit(
      parent,
      ["clone", "--no-local", "--no-checkout", "--no-tags", sourceRoot, cloneRoot],
      2 * 60 * 1000,
    );
    await candidateGit(cloneRoot, ["checkout", "--detach", sourceHead]);
    assert.equal(
      (await candidateGit(
        cloneRoot,
        ["status", "--porcelain=v1", "--untracked-files=all"],
      )).stdout,
      "",
      "the detached HEAD clone must start clean",
    );

    await copyCandidateOverlay(cloneRoot);
    const overlayPaths = await candidateChangedPaths(cloneRoot);
    const closureAlreadyCommitted = overlayPaths.length === 0;
    if (!closureAlreadyCommitted) {
      assert.deepEqual(
        overlayPaths,
        expectedPaths,
        "the ephemeral source delta must equal the exact reviewed Surface closure",
      );
    }
    const candidateCommit = closureAlreadyCommitted
      ? sourceHead
      : await commitCandidateSource(cloneRoot, expectedPaths);
    if (!closureAlreadyCommitted) {
      assert.equal(
        (await candidateGit(cloneRoot, ["rev-parse", "HEAD^"])).stdout.trim(),
        sourceHead,
        "the audited overlay commit must be the sole child of source HEAD",
      );
    }
    const committedOutput = (await candidateGit(
      cloneRoot,
      ["diff", "--name-only", `${sourceHead}..${candidateCommit}`],
    )).stdout.trim();
    const committedPaths = committedOutput === ""
      ? []
      : committedOutput.split("\n").sort();
    assert.deepEqual(
      committedPaths,
      closureAlreadyCommitted ? [] : expectedPaths,
      "the candidate commit must contain only the reviewed Surface closure",
    );
    assert.equal(
      (await candidateGit(
        cloneRoot,
        ["status", "--porcelain=v1", "--untracked-files=all"],
      )).stdout,
      "",
      "the committed candidate source must be clean",
    );
    const candidateTree = (await candidateGit(
      cloneRoot,
      ["rev-parse", "HEAD^{tree}"],
    )).stdout.trim();

    const environment = {
      ...sanitizedGitEnvironment(),
      CI: "true",
    };
    await execBounded("pnpm", ["install", "--offline", "--frozen-lockfile"], {
      cwd: cloneRoot,
      env: environment,
      encoding: "utf8",
      timeout: 10 * 60 * 1000,
    });
    assert.equal(
      (await candidateGit(
        cloneRoot,
        ["status", "--porcelain=v1", "--untracked-files=all"],
      )).stdout,
      "",
      "offline dependency installation must not mutate candidate source",
    );
    const scriptPath = path.join(cloneRoot, CANDIDATE_SCRIPT);
    await runCandidate(scriptPath, "assemble", candidateRoot, cloneRoot, environment);
    await runCandidate(scriptPath, "verify", candidateRoot, cloneRoot, environment);
    assert.equal(
      (await candidateGit(
        cloneRoot,
        ["status", "--porcelain=v1", "--untracked-files=all"],
      )).stdout,
      "",
      "candidate assembly and verification must leave source clean",
    );
    const previewPackage = JSON.parse(
      await readFile(path.join(cloneRoot, "packages/preview/package.json"), "utf8"),
    );
    const candidate = await readCandidate(
      candidateRoot,
      previewPackage.version,
      candidateCommit,
      candidateTree,
    );
    const exportPath = process.env.UNDERSTAND_CODE_SURFACE_CANDIDATE_EXPORT;
    if (exportPath !== undefined) {
      assert.equal(
        path.isAbsolute(exportPath) && path.normalize(exportPath) === exportPath,
        true,
        "candidate export path must be canonical and absolute",
      );
      await realpath(path.dirname(exportPath));
      await assert.rejects(
        stat(exportPath),
        (error) => error?.code === "ENOENT",
        "candidate export path must not already exist",
      );
      await cp(candidateRoot, exportPath, {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
    }
    return {
      candidate,
      cloneRoot,
      parent,
    };
  } catch (error) {
    await rm(parent, { recursive: true, force: true });
    throw error;
  }
}

async function seedLegacyTaskCanaries(repositoryRoot) {
  const taskRoot = path.join(
    repositoryRoot,
    ".understand-code",
    "tasks",
    DEMO_TASK_ID,
  );
  const taskPath = path.join(taskRoot, "task.json");
  const briefPath = path.join(taskRoot, "task-brief.json");
  const pulsePath = path.join(repositoryRoot, ".understand-code", "repo-pulse.json");

  const taskArtifact = JSON.parse(await readFile(taskPath, "utf8"));
  taskArtifact.repositoryId = LEGACY_TASK_REPOSITORY_CANARY;
  taskArtifact.worktreeId = LEGACY_TASK_WORKTREE_CANARY;
  taskArtifact.sourceSnapshotId = LEGACY_TASK_SNAPSHOT_CANARY;
  taskArtifact.payload.repositoryId = LEGACY_TASK_REPOSITORY_CANARY;
  taskArtifact.payload.worktreeId = LEGACY_TASK_WORKTREE_CANARY;
  taskArtifact.payload.baselineSnapshotId = LEGACY_TASK_SNAPSHOT_CANARY;
  taskArtifact.payload.latestSnapshotId = LEGACY_TASK_SNAPSHOT_CANARY;
  taskArtifact.payload.originalIntent = LEGACY_PULSE_FREE_TEXT_CANARY;
  taskArtifact.contentDigest = payloadContentDigest(taskArtifact.payload);
  const parsedTask = TaskManifestArtifactV1Schema.parse(taskArtifact);
  await writeFile(taskPath, `${JSON.stringify(parsedTask)}\n`, "utf8");

  const briefArtifact = JSON.parse(await readFile(briefPath, "utf8"));
  briefArtifact.repositoryId = LEGACY_TASK_REPOSITORY_CANARY;
  briefArtifact.worktreeId = LEGACY_TASK_WORKTREE_CANARY;
  briefArtifact.sourceSnapshotId = LEGACY_TASK_SNAPSHOT_CANARY;
  briefArtifact.payload.originalIntent = LEGACY_PULSE_FREE_TEXT_CANARY;
  assert.ok(
    briefArtifact.payload.readingPath[0],
    "the packed legacy Task canary requires a reading-path entry",
  );
  assert.ok(
    briefArtifact.payload.plannedChanges[0],
    "the packed legacy Task canary requires a planned-change entry",
  );
  briefArtifact.payload.readingPath[0].filePath = LEGACY_TASK_PATH_CANARY;
  briefArtifact.payload.plannedChanges[0].filePath = LEGACY_TASK_PATH_CANARY;
  briefArtifact.contentDigest = payloadContentDigest(briefArtifact.payload);
  const parsedBrief = TaskBriefArtifactV1Schema.parse(briefArtifact);
  await writeFile(briefPath, `${JSON.stringify(parsedBrief)}\n`, "utf8");

  const pulseArtifact = JSON.parse(await readFile(pulsePath, "utf8"));
  const payload = pulseArtifact.payload;
  assert.equal(
    Object.hasOwn(payload, "profile"),
    false,
    "the packed Browser negative must contain a legacy persisted Pulse",
  );
  assert.ok(payload.repositoryState, "the legacy Pulse canary requires repository state");
  assert.ok(payload.changeSummary, "the legacy Pulse canary requires aggregate changes");
  pulseArtifact.repositoryId = LEGACY_TASK_REPOSITORY_CANARY;
  pulseArtifact.worktreeId = LEGACY_TASK_WORKTREE_CANARY;
  pulseArtifact.sourceSnapshotId = LEGACY_TASK_SNAPSHOT_CANARY;
  payload.evaluatedSnapshotId = LEGACY_TASK_SNAPSHOT_CANARY;
  payload.baselineSnapshotId = LEGACY_TASK_SNAPSHOT_CANARY;
  payload.status = "partial";
  payload.repositoryState.branch = LEGACY_PULSE_BRANCH_CANARY;
  payload.repositoryState.headCommit = LEGACY_PULSE_OID_CANARY;
  payload.repositoryState.rootIdentity = LEGACY_PULSE_DIGEST_CANARY;
  payload.reasons = [LEGACY_PULSE_FREE_TEXT_CANARY];
  pulseArtifact.contentDigest = payloadContentDigest(payload);
  const parsedPulse = RepoPulseArtifactV1Schema.parse(pulseArtifact);
  await writeFile(pulsePath, `${JSON.stringify(parsedPulse)}\n`, "utf8");

  const seededBytes = (
    await Promise.all([
      readFile(taskPath, "utf8"),
      readFile(briefPath, "utf8"),
      readFile(pulsePath, "utf8"),
    ])
  ).join("\n");
  for (const canary of LEGACY_PULSE_CANARIES) {
    assert.equal(
      seededBytes.includes(canary),
      true,
      `the persisted legacy Task/Pulse negative must contain its private canary: ${canary}`,
    );
  }
}

async function seedUnauthorizedStrongPulse(repositoryRoot) {
  const taskRoot = path.join(
    repositoryRoot,
    ".understand-code",
    "tasks",
    DEMO_TASK_ID,
  );
  const taskPath = path.join(taskRoot, "task.json");
  const briefPath = path.join(taskRoot, "task-brief.json");
  const pulsePath = path.join(repositoryRoot, ".understand-code", "repo-pulse.json");

  const taskArtifact = JSON.parse(await readFile(taskPath, "utf8"));
  taskArtifact.repositoryId = STRONG_REPOSITORY_ID;
  taskArtifact.worktreeId = STRONG_WORKTREE_ID;
  taskArtifact.sourceSnapshotId = STRONG_EVALUATED_SNAPSHOT_ID;
  taskArtifact.payload.repositoryId = STRONG_REPOSITORY_ID;
  taskArtifact.payload.worktreeId = STRONG_WORKTREE_ID;
  taskArtifact.payload.baselineSnapshotId = STRONG_TASK_BASELINE_SNAPSHOT_ID;
  taskArtifact.payload.latestSnapshotId = STRONG_EVALUATED_SNAPSHOT_ID;
  taskArtifact.contentDigest = payloadContentDigest(taskArtifact.payload);
  const parsedTask = TaskManifestArtifactV1Schema.parse(taskArtifact);
  await writeFile(taskPath, `${JSON.stringify(parsedTask)}\n`, "utf8");

  const briefArtifact = JSON.parse(await readFile(briefPath, "utf8"));
  briefArtifact.repositoryId = STRONG_REPOSITORY_ID;
  briefArtifact.worktreeId = STRONG_WORKTREE_ID;
  briefArtifact.sourceSnapshotId = STRONG_EVALUATED_SNAPSHOT_ID;
  briefArtifact.contentDigest = payloadContentDigest(briefArtifact.payload);
  const parsedBrief = TaskBriefArtifactV1Schema.parse(briefArtifact);
  await writeFile(briefPath, `${JSON.stringify(parsedBrief)}\n`, "utf8");

  const legacyPulseArtifact = JSON.parse(await readFile(pulsePath, "utf8"));
  const payload = {
    profile: "repo_pulse_path_safe_v1",
    evaluatedSnapshotId: STRONG_EVALUATED_SNAPSHOT_ID,
    evaluatedSnapshotContentDigest: STRONG_PULSE_DIGEST_CANARY,
    baselineSnapshotId: STRONG_PULSE_BASELINE_SNAPSHOT_CANARY,
    status: "partial",
    artifactFreshness: {
      graph: "partial",
      wiki: "partial",
      evidence: "partial",
      diff: "partial",
      task: "partial",
    },
    repositoryState: {
      repositoryId: STRONG_REPOSITORY_ID,
      worktreeId: STRONG_WORKTREE_ID,
      rootIdentity: STRONG_ROOT_IDENTITY,
      branchState: {
        status: "safe",
        name: STRONG_PULSE_BRANCH_CANARY,
      },
      objectFormat: "sha1",
      headState: {
        kind: "commit",
        commit: STRONG_PULSE_OID_CANARY,
      },
      repositoryStateToken: STRONG_PULSE_TOKEN_CANARY,
      captureStatus: "partial",
    },
    changeSummary: {
      total: 0,
      bySource: {
        committed: 0,
        staged: 0,
        unstaged: 0,
        untracked: 0,
        conflict: 0,
      },
      byKind: {
        added: 0,
        modified: 0,
        deleted: 0,
        renamed: 0,
        copied: 0,
        type_changed: 0,
      },
    },
    security: {
      snapshotProfile: "repository_snapshot_path_safe_v1",
      safeChangeCount: 0,
      redactedChangeCount: 0,
      unknownStateCount: 1,
      redactionBoundaryCodes: [],
      uncertaintyCodes: ["unreadable"],
    },
    securityScanPolicyDigest: STRONG_PULSE_DIGEST_CANARY,
    safeGitExecutionDigest: STRONG_PULSE_DIGEST_CANARY,
    completeness: {
      parser: {
        status: "partial",
        coverage: 0.5,
        reasonCodes: ["parser_partial"],
      },
      callGraph: {
        status: "partial",
        coverage: 0.5,
        reasonCodes: ["call_graph_partial"],
      },
    },
    recommendedRefresh: "full",
    diagnosticCodes: ["repository_capture_partial"],
    evaluatedAt: "2026-08-23T00:00:00.000Z",
  };
  const strongPulseArtifact = RepoPulseArtifactV1Schema.parse({
    schemaVersion: legacyPulseArtifact.schemaVersion,
    artifactType: "repo_pulse",
    artifactId: legacyPulseArtifact.artifactId,
    repositoryId: STRONG_REPOSITORY_ID,
    worktreeId: STRONG_WORKTREE_ID,
    sourceSnapshotId: STRONG_EVALUATED_SNAPSHOT_ID,
    revision: legacyPulseArtifact.revision,
    producerVersion: legacyPulseArtifact.producerVersion,
    createdAt: legacyPulseArtifact.createdAt,
    contentDigest: payloadContentDigest(payload),
    payload,
  });
  await writeFile(pulsePath, `${JSON.stringify(strongPulseArtifact)}\n`, "utf8");
  const seededBytes = (
    await Promise.all([
      readFile(taskPath, "utf8"),
      readFile(briefPath, "utf8"),
      readFile(pulsePath, "utf8"),
    ])
  ).join("\n");
  for (const canary of STRONG_PULSE_CANARIES) {
    assert.equal(
      seededBytes.includes(canary),
      true,
      `the persisted unauthorized strong Task/Pulse negative must contain its private canary: ${canary}`,
    );
  }
}

function installedLocations(installDirectory) {
  const binRoot = process.platform === "win32"
    ? installDirectory
    : path.join(installDirectory, "bin");
  const modulesRoot = process.platform === "win32"
    ? path.join(installDirectory, "node_modules")
    : path.join(installDirectory, "lib/node_modules");
  return {
    packageRoot: path.join(modulesRoot, "@understand-code/preview"),
    previewBin: path.join(
      binRoot,
      process.platform === "win32"
        ? "understand-code-preview.cmd"
        : "understand-code-preview",
    ),
  };
}

async function snapshotRuntimeCriticalFiles(installedPackageRoot) {
  const releaseManifestPath = "dist/release-manifest.json";
  const releaseManifestBytes = await readFile(
    path.join(installedPackageRoot, releaseManifestPath),
  );
  const releaseManifest = JSON.parse(releaseManifestBytes.toString("utf8"));
  const dashboardIndexPath = path.posix.join(
    releaseManifest.dashboard.root,
    "index.html",
  );
  const dashboardIndex = await readFile(
    path.join(installedPackageRoot, dashboardIndexPath),
    "utf8",
  );
  const entryMatch = dashboardIndex.match(
    /<script\b[^>]*\bsrc=["'](?<source>\/assets\/index-[A-Za-z0-9_-]+\.js)["'][^>]*>/iu,
  );
  assert.ok(
    entryMatch?.groups?.source,
    "the installed Dashboard must name one hashed React entry asset",
  );
  const criticalPaths = [
    releaseManifestPath,
    releaseManifest.cli.path,
    releaseManifest.runtime.contracts.path,
    releaseManifest.runtime.server.path,
    releaseManifest.dashboard.manifest,
    path.posix.join(
      releaseManifest.dashboard.root,
      entryMatch.groups.source.slice(1),
    ),
  ].sort();
  return Promise.all(criticalPaths.map(async (relativePath) => ({
    path: relativePath,
    sha256: contentDigest(await readFile(path.join(installedPackageRoot, relativePath))),
  })));
}

function startPackedPreview(executable, cwd) {
  const child = spawn(
    executable,
    ["--demo", "--port", "0", "--no-open"],
    {
      cwd,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const ready = withTimeout(new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    createInterface({ input: child.stdout }).on("line", (line) => {
      stdout.push(line);
      if (!line.startsWith("PREVIEW_READY ")) return;
      try {
        resolve(JSON.parse(line.slice("PREVIEW_READY ".length)));
      } catch (error) {
        reject(error);
      }
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (stdout.every((line) => !line.startsWith("PREVIEW_READY "))) {
        reject(new Error(
          `packed Preview exited before ready (code=${code}, signal=${signal}): ${stderr.join("") || stdout.join("\n")}`,
        ));
      }
    });
  }), "packed Repository Surface Preview ready", 30_000);
  return { child, ready };
}

function taskUrl(ready) {
  const url = new URL(`/tasks/${encodeURIComponent(DEMO_TASK_ID)}`, ready.url);
  url.searchParams.set("section", "summary");
  url.searchParams.set("token", ready.token);
  return url;
}

async function fetchTaskBriefProjection(browser, ready) {
  const projectionUrl = new URL(
    `/tasks/${encodeURIComponent(DEMO_TASK_ID)}/brief.json`,
    ready.url,
  );
  projectionUrl.searchParams.set("section", "summary");
  projectionUrl.searchParams.set("token", ready.token);
  return browser.evaluate(`fetch(
    ${JSON.stringify(projectionUrl.toString())},
    { credentials: 'same-origin', headers: { accept: 'application/json' } },
  ).then(async (response) => ({
    statusCode: response.status,
    payload: await response.json(),
  }))`);
}

function assertCanariesAbsent(
  canaries,
  serializedResponse,
  rawHtml,
  domHtml,
  label,
) {
  for (const canary of canaries) {
    assert.equal(
      serializedResponse.includes(canary),
      false,
      `the locked Task response must not contain the private ${label} canary: ${canary}`,
    );
    assert.equal(
      rawHtml.includes(canary),
      false,
      `the packed HTML must not contain the private ${label} canary: ${canary}`,
    );
    assert.equal(
      domHtml.includes(canary),
      false,
      `the Browser DOM must not contain the private ${label} canary: ${canary}`,
    );
  }
}

async function assertTaskSurfaceUnavailable(browser, ready, canaries, label) {
  const pageResponse = await fetch(taskUrl(ready));
  assert.equal(pageResponse.status, 200, "the locked Task route must still serve the Dashboard shell");
  const rawHtml = await pageResponse.text();

  await browser.navigate(taskUrl(ready).toString());
  await browser.waitFor(
    "document.querySelector('[data-testid=\"task-first-workbench\"]')?.getAttribute('data-state') === 'error'",
    `${label} Task Workbench fail-closed state`,
    30_000,
  );
  const projection = await fetchTaskBriefProjection(browser, ready);
  assert.equal(projection.statusCode, 503);
  assert.deepEqual(projection.payload, {
    error: "provider_unavailable",
    reason: "unavailable",
  });
  const dom = await browser.evaluate(`(() => {
    const workbench = document.querySelector('[data-testid="task-first-workbench"]');
    return {
      html: document.documentElement.outerHTML,
      state: workbench?.getAttribute('data-state') ?? null,
      text: workbench?.textContent ?? '',
    };
  })()`);
  assert.equal(dom.state, "error");
  assert.match(
    dom.text,
    /(?:could not read this Task Brief|Task Brief is unavailable)/u,
    "the Browser must render an unavailable/error Task state",
  );
  assertCanariesAbsent(
    canaries,
    JSON.stringify(projection.payload),
    rawHtml,
    dom.html,
    label,
  );
}

test(
  "verified candidate tgz fails Task surfaces closed without exposing legacy or unauthorized strong state",
  { timeout: 45 * 60 * 1000 },
  async (t) => {
    const browserExecutable = await resolveBrowserExecutable();
    if (browserExecutable === null) {
      assert.equal(
        REQUIRE_REAL_BROWSER,
        false,
        "UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 requires UNDERSTAND_CODE_BROWSER_EXECUTABLE or an installed Chrome/Chromium",
      );
      t.skip(
        "Chrome/Chromium is unavailable; the release gate sets UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1",
      );
      return;
    }

    const installDirectory = await mkdtemp(
      path.join(tmpdir(), "uc-surface-install-"),
    );
    const browserProfile = await mkdtemp(
      path.join(tmpdir(), "uc-surface-browser-"),
    );
    let browser = null;
    let candidateWorkspace = null;
    let preview = null;
    try {
      candidateWorkspace = await createSurfaceCandidate();
      const { candidate } = candidateWorkspace;
      const candidateDigest = contentDigest(candidate.tarballBytes);
      assert.equal(candidate.manifest.subject.sha256, candidateDigest);
      t.diagnostic(JSON.stringify({
        candidateCommit: candidate.manifest.source.commit,
        candidateTree: candidate.manifest.source.tree,
        tarballSha256: candidateDigest,
        tarballRegularFileCount: candidate.fileCount,
      }));
      await execBounded(
        "npm",
        [
          "install",
          "--global",
          "--prefix",
          installDirectory,
          "--ignore-scripts",
          "--no-package-lock",
          "--no-audit",
          "--no-fund",
          candidate.tarballPath,
        ],
        { cwd: installDirectory, encoding: "utf8", timeout: 5 * 60 * 1000 },
      );
      assert.equal(
        contentDigest(await readFile(candidate.tarballPath)),
        candidateDigest,
        "installation must consume the exact verified candidate subject",
      );

      const installed = installedLocations(installDirectory);
      const installedPackage = JSON.parse(
        await readFile(path.join(installed.packageRoot, "package.json"), "utf8"),
      );
      assert.deepEqual(
        { name: installedPackage.name, version: installedPackage.version },
        candidate.manifest.package,
      );
      const installedReleaseManifest = await readFile(
        path.join(installed.packageRoot, "dist", "release-manifest.json"),
      );
      assert.equal(
        contentDigest(installedReleaseManifest),
        candidate.manifest.embeddedReleaseManifest.sha256,
        "installed release-manifest bytes must remain bound to the candidate manifest",
      );

      const demoRoot = path.join(installed.packageRoot, "dist", "demo");
      const runtimeCriticalBaseline = await snapshotRuntimeCriticalFiles(
        installed.packageRoot,
      );
      await seedLegacyTaskCanaries(demoRoot);
      assert.deepEqual(
        await snapshotRuntimeCriticalFiles(installed.packageRoot),
        runtimeCriticalBaseline,
        "legacy negative fixture seeding must not mutate installed candidate runtime bytes",
      );
      let started = startPackedPreview(installed.previewBin, installDirectory);
      preview = started.child;
      let ready = await started.ready;
      assert.equal(ready.mode, "demo");

      browser = await launchBrowser({
        executable: browserExecutable,
        userDataDir: browserProfile,
        timeoutMs: 30_000,
      });
      await assertTaskSurfaceUnavailable(
        browser,
        ready,
        LEGACY_PULSE_CANARIES,
        "legacy Task/Pulse",
      );

      await stopChild(preview);
      preview = null;
      await seedUnauthorizedStrongPulse(demoRoot);
      assert.deepEqual(
        await snapshotRuntimeCriticalFiles(installed.packageRoot),
        runtimeCriticalBaseline,
        "strong negative fixture seeding must not mutate installed candidate runtime bytes",
      );
      started = startPackedPreview(installed.previewBin, installDirectory);
      preview = started.child;
      ready = await started.ready;
      assert.equal(ready.mode, "demo");
      await assertTaskSurfaceUnavailable(
        browser,
        ready,
        [...LEGACY_PULSE_CANARIES, ...STRONG_PULSE_CANARIES],
        "unauthorized strong Task/Pulse",
      );
      assert.deepEqual(
        browser.pageErrors,
        [],
        "legacy and unauthorized strong Task rejection must not throw in Browser",
      );
    } finally {
      if (browser !== null) await browser.close().catch(() => undefined);
      if (preview !== null) await stopChild(preview).catch(() => undefined);
      await Promise.all([
        candidateWorkspace === null
          ? Promise.resolve()
          : rm(candidateWorkspace.parent, { recursive: true, force: true }),
        rm(installDirectory, { recursive: true, force: true }),
        rm(browserProfile, { recursive: true, force: true }),
      ]);
    }
  },
);
