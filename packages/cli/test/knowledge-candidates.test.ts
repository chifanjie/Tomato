import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrongRepoPulseV1Schema, StrongRepositorySnapshotV1Schema } from "@understand-code/contracts";
import { openWorkbenchSessionV1 } from "@understand-code/workbench-runtime";
import { PRODUCT_VERSION } from "../src/constants.js";
import { createWorkbenchDashboardReaderInternalV1 } from "../src/handlers/tools.js";
import {
  buildRepositoryIndex, discardStagedRepositoryIndex, publishStagedRepositoryIndex,
  savePendingRepositoryIndexV1, withRepositoryIndexKnowledgeLineageV1,
} from "../src/runtime/repository-indexer.js";

const roots: string[] = [];
const sessions: Awaited<ReturnType<typeof openWorkbenchSessionV1>>[] = [];
const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const otherTaskId = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
const repositoryId = `repo-hmac-${"1".repeat(64)}`;
const worktreeId = `worktree-hmac-${"2".repeat(64)}`;
const digest = (c: string) => `sha256:${c.repeat(64)}` as const;
const timestamp = "2026-09-01T00:00:00.000Z";

function snapshot(c = "a") {
  const token = `hmac-sha256:${"4".repeat(64)}`;
  return StrongRepositorySnapshotV1Schema.parse({
    schemaVersion: 1, profile: "repository_snapshot_path_safe_v1", snapshotId: `snapshot-${c.repeat(64)}`,
    repositoryId, worktreeId, rootIdentity: `root-hmac-${"5".repeat(64)}`,
    branchState: { status: "detached" }, objectFormat: "sha1",
    headState: { kind: "commit", commit: c.repeat(40) }, repositoryStateToken: token,
    indexToken: token, worktreeToken: token, untrackedToken: token, ignoreToken: token,
    securityScanPolicyDigest: digest("6"), safeGitExecutionDigest: digest("7"),
    createdAt: timestamp, captureStatus: "complete",
    accounting: { rawLayerUnitCount: 0, candidateUnitCount: 0, safeChangeCount: 0,
      redactedKnownChangeCount: 0, unknownStateCount: 0 },
    changes: [], redactedChanges: [], unknownStates: [],
  });
}

function pulse(current: ReturnType<typeof snapshot>) {
  return StrongRepoPulseV1Schema.parse({
    profile: "repo_pulse_path_safe_v1", evaluatedSnapshotId: current.snapshotId,
    evaluatedSnapshotContentDigest: digest("8"), status: "fresh",
    artifactFreshness: { graph: "fresh", wiki: "fresh", evidence: "fresh", diff: "fresh", task: "fresh" },
    repositoryState: { repositoryId, worktreeId, rootIdentity: current.rootIdentity,
      branchState: current.branchState, objectFormat: current.objectFormat,
      headState: current.headState, repositoryStateToken: current.repositoryStateToken,
      captureStatus: "complete" },
    changeSummary: { total: 0,
      bySource: { committed: 0, staged: 0, unstaged: 0, untracked: 0, conflict: 0 },
      byKind: { added: 0, modified: 0, deleted: 0, renamed: 0, copied: 0, type_changed: 0 } },
    security: { snapshotProfile: "repository_snapshot_path_safe_v1", safeChangeCount: 0,
      redactedChangeCount: 0, unknownStateCount: 0, redactionBoundaryCodes: [], uncertaintyCodes: [] },
    securityScanPolicyDigest: digest("6"), safeGitExecutionDigest: digest("7"),
    completeness: { parser: { status: "complete", coverage: 1, reasonCodes: [] },
      callGraph: { status: "complete", coverage: 1, reasonCodes: [] } },
    recommendedRefresh: "none", diagnosticCodes: [], evaluatedAt: timestamp,
  });
}

/** Real index persistence and HTTP; only the trusted Task/Provider input ports are fixtures. */
async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "uc-knowledge-reader-")));
  roots.push(root);
  const canonicalRoot = path.join(root, "repository");
  const canonicalInstallationRoot = path.join(root, "installation");
  await mkdir(canonicalRoot, { mode: 0o700 });
  await mkdir(canonicalInstallationRoot, { mode: 0o700 });
  await writeFile(path.join(canonicalRoot, "safe.ts"), "export const safe = true;\n");
  let current = snapshot();
  const snapshots = new Map<string, ReturnType<typeof snapshot>>([[current.snapshotId, current]]);
  const task = { taskId, taskProfile: "agent_task_v1", revision: 4, repositoryId, worktreeId,
    latestSnapshotId: current.snapshotId, status: "in_progress" };
  const lineage = { schemaVersion: 1 as const, status: "pending" as const, taskId, taskRevision: 4,
    sourceSnapshotId: current.snapshotId, requestDigest: digest("c"), idempotencyKeyDigest: digest("d") };
  const scope = { canonicalRoot, canonicalInstallationRoot, operationId: "1".repeat(32) };
  const built = await buildRepositoryIndex({ ...scope, snapshot: current, knowledgeLineage: lineage });
  await savePendingRepositoryIndexV1({ canonicalRoot, ...built });
  await discardStagedRepositoryIndex(scope);
  let authority: ({ sourceSnapshotId: string; finalizedProviderRevision: number } & typeof built.generation) | undefined;
  const inspect = vi.fn(async () => authority && { ...authority });
  const inspectRefresh = vi.fn(async (): Promise<{
    authority: { repositoryId: string; worktreeId: string; snapshotId: string; snapshotContentDigest: string;
      pulseContentDigest: string; finalizedProviderRevision: number } | undefined;
    observedProviderRevision: number;
  }> => ({ authority: { repositoryId, worktreeId, snapshotId: current.snapshotId,
    snapshotContentDigest: digest("1"), pulseContentDigest: digest("2"), finalizedProviderRevision: 3 },
  observedProviderRevision: 7 }));
  const store = { repositoryId, worktreeId, layout: { worktreeRoot: canonicalRoot },
    readManifest: vi.fn(async () => ({ artifacts: [{ artifactType: "task_manifest", taskId,
      sourceSnapshotId: task.latestSnapshotId }] })),
    readTaskBundle: vi.fn(async () => ({ bundle: { manifest: task }, artifacts: [], receipts: [] })),
    readArtifact: vi.fn(async (kind: string, input?: { snapshotId: string }) => ({ artifact: {
      artifactType: kind, contentDigest: kind === "repo_pulse" ? digest("2") : digest("1"),
      payload: kind === "repo_pulse" ? pulse(current) : snapshots.get(input!.snapshotId),
    } })),
  };
  const runtime = { store, providerClient: { inspectIndexPublicationAuthority: inspect, inspectStrongRefreshAuthority: inspectRefresh } };
  const reader = createWorkbenchDashboardReaderInternalV1(
    runtime as unknown as Parameters<typeof createWorkbenchDashboardReaderInternalV1>[0],
  );
  const binding = () => ({ productVersion: PRODUCT_VERSION, repositoryId, worktreeId,
    sourceSnapshotId: current.snapshotId,
    headCommit: current.headState.kind === "commit" ? current.headState.commit : null,
    freshness: "fresh" as const, route: { view: "tasks" as const, taskId } });
  const read = (kind: string, extra: Record<string, unknown> = {}) => reader({
    ...binding(), kind, ...(kind === "task_knowledge_candidates" ? { taskId } : {}), ...extra,
  } as Parameters<typeof reader>[0]);
  const pending = { indexVersion: "pending", indexGenerationId: built.generation.generationId };
  const wiki = JSON.parse(built.publication.files.find((file) => file.relativePath === "knowledge-base/wiki-index.json")!.bytes.toString("utf8")) as {
    pages: { markdownPath: string; id: string }[];
  };
  const promote = async () => {
    const promoted = withRepositoryIndexKnowledgeLineageV1({ ...built,
      knowledgeLineage: { ...lineage, status: "published", taskRevision: 7,
        candidateGenerationId: built.generation.generationId, currentCheckId: "check:current",
        verificationIds: ["verification:passed"] },
    });
    authority = { ...promoted.generation, sourceSnapshotId: current.snapshotId, finalizedProviderRevision: 7 };
    task.revision = 7;
    task.status = "verified";
    await publishStagedRepositoryIndex({ ...scope, ...promoted, authority, publishStoreCut: async () => undefined });
    return promoted;
  };
  const http = async () => {
    const dashboardRoot = path.join(root, "dashboard");
    await mkdir(dashboardRoot);
    const html = "<!doctype html><html><body>HTTP integration fixture, not visual QA</body></html>";
    await writeFile(path.join(dashboardRoot, "index.html"), html);
    const inventory = [{ path: "index.html", sha256: `sha256:${createHash("sha256").update(html).digest("hex")}`,
      bytes: Buffer.byteLength(html) }];
    const session = await openWorkbenchSessionV1({ route: binding().route, openBrowser: false }, {
      ...binding(), canonicalRoot, worktreeFingerprint: digest("e"), dashboardReader: reader,
      dashboardBundle: { root: dashboardRoot, productVersion: PRODUCT_VERSION, fileCount: 1,
        inventorySha256: `sha256:${createHash("sha256").update(JSON.stringify(inventory)).digest("hex")}` },
    });
    sessions.push(session);
    const base = `http://127.0.0.1:${session.port}`;
    const token = session.output.structuredContent.result.deepLink.split("#")[1];
    const launch = await fetch(`${base}/__workbench/launch`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    expect(launch.status).toBe(200);
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    return (relativePath: string) => fetch(`${base}${relativePath}`, { headers: { cookie } });
  };
  return { root, canonicalRoot, canonicalInstallationRoot, built, lineage, task, inspect, inspectRefresh, store,
    read, pending, wiki, promote, http,
    advanceSnapshot() { current = snapshot("b"); snapshots.set(current.snapshotId, current); task.latestSnapshotId = current.snapshotId; },
  };
}

afterEach(async () => {
  await Promise.all(sessions.splice(0).map((session) => session.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Task knowledge candidate reader integration", () => {
  it("lists durable candidates without requiring or creating an active publication", async () => {
    const f = await fixture();
    expect(await f.read("task_knowledge_candidates")).toEqual({ status: "ready", json: {
      schemaVersion: 1, taskId, currentTaskRevision: 4, currentSnapshotId: f.lineage.sourceSnapshotId,
      candidates: [{ candidateGenerationId: f.built.generation.generationId, taskRevision: 4,
        sourceSnapshotId: f.lineage.sourceSnapshotId, sourceSnapshotMatchesCurrent: true }],
    } });
    expect(await readdir(path.join(f.canonicalRoot, ".understand-code"))).toEqual(["index-pending-v1"]);
    expect(await f.read("graph")).not.toMatchObject({ status: "ready" });
  });

  it("serves the same persisted Graph/Wiki bytes through authenticated, Task-bound HTTP", async () => {
    const f = await fixture();
    const get = await f.http();
    const listed = await get(`/tasks/${taskId}/knowledge-candidates.json`);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({ taskId, candidates: [{ candidateGenerationId: f.built.generation.generationId }] });
    const selector = `?indexVersion=pending&indexGenerationId=${f.built.generation.generationId}`;
    for (const name of ["knowledge-graph.json", "knowledge-base/wiki-index.json", "knowledge-base/search-index.json", f.wiki.pages[0]!.markdownPath]) {
      const response = await get(`/${name}${selector}`);
      expect(response.status, name).toBe(200);
      const file = f.built.publication.files.find((entry) => entry.relativePath === name)!;
      if (name.endsWith(".json")) expect(await response.json()).toEqual(JSON.parse(file.bytes.toString("utf8")));
      else expect(await response.text()).toBe(file.bytes.toString("utf8"));
    }
    const meta = await get(`/meta.json${selector}`);
    expect(await meta.json()).toMatchObject({ knowledgeVersion: { status: "pending", readOnly: true,
      evidenceEligible: false, taskId, taskRevision: 4, generationId: f.built.generation.generationId,
      sourceSnapshotId: f.lineage.sourceSnapshotId, currentSnapshotId: f.lineage.sourceSnapshotId } });
    for (const url of [`/tasks/${otherTaskId}/knowledge-candidates.json`,
      `/tasks/${taskId}/knowledge-candidates.json?taskId=${otherTaskId}`,
      "/meta.json?indexVersion=pending", `/config.json${selector}`,
      `/knowledge-base/.trace/task-lineage.json${selector}`]) {
      expect((await get(url)).status, url).not.toBe(200);
    }
  });

  it("does not read a candidate for a different Task or a future Task revision", async () => {
    const f = await fixture();
    expect(await f.read("meta", f.pending)).toMatchObject({ status: "ready" });
    expect(await f.read("graph", { ...f.pending, route: { view: "tasks", taskId: otherTaskId } }))
      .not.toMatchObject({ status: "ready" });
    f.task.revision = 3;
    expect(await f.read("graph", f.pending)).not.toMatchObject({ status: "ready" });
  });

  it("keeps old candidates discoverable but refuses to read them as current-Snapshot knowledge", async () => {
    const f = await fixture();
    f.advanceSnapshot();
    expect(await f.read("task_knowledge_candidates")).toMatchObject({ status: "ready", json: {
      currentSnapshotId: snapshot("b").snapshotId, candidates: [{ sourceSnapshotMatchesCurrent: false }],
    } });
    expect(await f.read("meta", f.pending)).toEqual({ status: "stale" });
    expect(await f.read("graph", f.pending)).toEqual({ status: "stale" });
  });

  it("rejects tampered persisted candidate bytes for both discovery and preview", async () => {
    const f = await fixture();
    expect(await f.read("meta", f.pending)).toMatchObject({ status: "ready" });
    const target = path.join(f.canonicalRoot, ".understand-code/index-pending-v1", f.built.generation.generationId, "knowledge-graph.json");
    const before = await readFile(target);
    await writeFile(target, Buffer.concat([before, Buffer.from("\n")]));
    expect(await f.read("task_knowledge_candidates")).not.toMatchObject({ status: "ready" });
    expect(await f.read("graph", f.pending)).not.toMatchObject({ status: "ready" });
    expect(await readFile(target)).toEqual(Buffer.concat([before, Buffer.from("\n")]));
  });

  it("identifies only the Provider-pinned published candidate and exposes redacted Task lineage", async () => {
    const f = await fixture();
    const published = await f.promote();
    expect(await f.read("task_knowledge_candidates")).toMatchObject({ status: "ready", json: {
      currentTaskRevision: 7, candidates: [{ candidateGenerationId: f.built.generation.generationId,
        publishedGenerationId: published.generation.generationId }],
    } });
    const result = await f.read("meta", { indexVersion: "published", indexGenerationId: published.generation.generationId });
    expect(result).toMatchObject({ status: "ready", json: { knowledgeVersion: { lineage: {
      schemaVersion: 1, status: "published", taskId, taskRevision: 7,
      sourceSnapshotId: f.lineage.sourceSnapshotId, candidateGenerationId: f.built.generation.generationId,
      currentCheckId: "check:current", verificationIds: ["verification:passed"],
    } } } });
    expect(JSON.stringify(result)).not.toContain("requestDigest");
    expect(JSON.stringify(result)).not.toContain("idempotencyKeyDigest");
    expect(await f.read("meta", f.pending)).toMatchObject({ status: "ready", json: {
      knowledgeVersion: { status: "pending", evidenceEligible: false },
    } });
  });

  it("fails closed when the Provider publication changes during lineage discovery", async () => {
    const f = await fixture();
    await f.promote();
    expect(await f.read("meta", { indexVersion: "published" })).toMatchObject({ status: "ready" });
    const authority = await f.inspect();
    f.inspect.mockResolvedValueOnce(authority).mockResolvedValue({ ...authority!, generationId: `generation-${"f".repeat(64)}` });
    expect(await f.read("meta", { indexVersion: "published" })).not.toMatchObject({ status: "ready" });
  });

  it("requires the current Provider refresh binding even when no index has been published", async () => {
    const f = await fixture();
    expect(await f.read("meta", f.pending)).toMatchObject({ status: "ready" });
    f.inspectRefresh.mockResolvedValue({ authority: undefined, observedProviderRevision: 7 });
    expect(await f.read("task_knowledge_candidates")).not.toMatchObject({ status: "ready" });
    expect(await f.read("meta", f.pending)).not.toMatchObject({ status: "ready" });
  });

  it("rejects a Provider refresh digest change while reading a candidate", async () => {
    const f = await fixture();
    expect(await f.read("meta", f.pending)).toMatchObject({ status: "ready" });
    const refresh = await f.inspectRefresh();
    f.inspectRefresh.mockResolvedValueOnce(refresh).mockResolvedValue({ ...refresh,
      authority: { ...refresh.authority!, snapshotContentDigest: digest("f") } });
    expect(await f.read("meta", f.pending)).not.toMatchObject({ status: "ready" });
  });
});
