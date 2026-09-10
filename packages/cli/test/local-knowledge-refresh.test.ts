import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { closeAllWorkbenchSessionsV1 } from "@understand-code/workbench-runtime";
import { callImplementedTool } from "../src/handlers/tools.js";
import { localRefreshIndexV1 } from "../src/handlers/local-refresh-index.js";
import {
  assertRepositoryKnowledgeWriterReadyV1, openActiveRepositoryIndexV1, readPendingRepositoryIndexV1,
  readRepositoryIndexSourceV1, openRepositoryIndexSourcesV1,
} from "../src/runtime/repository-indexer.js";
import { cleanupTemporaryDirectories, createGitRepository } from "./helpers.js";
import * as repositoryIndexer from "../src/runtime/repository-indexer.js";

afterEach(async () => { await closeAllWorkbenchSessionsV1(); await cleanupTemporaryDirectories(); });
const local = { runtimeProfile: "local_durable_v1" as const };

describe("local source knowledge lifecycle", () => {
  it("stages Task-bound diagnostic candidates, replays receipts, and refuses formal publication before verification", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const init = { mode: "full" as const, actor: "codex" as const, idempotencyKey: "knowledge-init" };
    const initialized = await localRefreshIndexV1(init, root);
    expect(await localRefreshIndexV1(init, root)).toEqual(initialized);
    await expect(localRefreshIndexV1({ ...init, mode: "incremental" }, root)).rejects.toThrow();
    const created: any = await callImplementedTool("build_task_brief", {
      task: "Explain the return value with source evidence", expectedRevision: 0, actor: "codex", idempotencyKey: "knowledge-task",
    }, root, local);
    expect(created.isError, JSON.stringify(created)).toBe(false);
    const task = created.structuredContent.result.task;
    const active = await openActiveRepositoryIndexV1(root);
    const request = { mode: "full" as const, actor: "codex" as const, idempotencyKey: "knowledge-stage",
      expectedSourceSnapshotId: active.authority.sourceSnapshotId,
      knowledge: { action: "stage" as const, taskId: task.taskId, expectedTaskRevision: task.revision } };
    const staged: any = await localRefreshIndexV1(request, root);
    expect(staged.structuredContent.result.knowledge).toMatchObject({ status: "pending", taskId: task.taskId });
    expect(await localRefreshIndexV1(request, root)).toEqual(staged);
    expect((await openActiveRepositoryIndexV1(root)).generation).toEqual(active.generation);
    const candidateGenerationId = staged.structuredContent.result.knowledge.candidateGenerationId;
    const candidate = await readPendingRepositoryIndexV1({ canonicalRoot: root, generationId: candidateGenerationId });
    const opened: any = await callImplementedTool("open_workbench", { route: { view: "tasks", taskId: task.taskId, section: "summary" } }, root, local);
    expect(opened.isError, JSON.stringify(opened)).not.toBe(true);
    const url = new URL(opened.structuredContent.result.deepLink);
    const launched = await fetch(new URL("/__workbench/launch", url), { method: "POST", headers: { "content-type": "application/json", origin: url.origin }, body: JSON.stringify({ token: url.hash.slice(1) }) });
    expect(launched.status).toBe(200);
    const cookie = launched.headers.get("set-cookie")!.split(";", 1)[0]!;
    const candidateList = await fetch(new URL(`/tasks/${encodeURIComponent(task.taskId)}/knowledge-candidates.json`, url), { headers: { cookie } });
    const listBody = await candidateList.text();
    expect(candidateList.status, listBody).toBe(200);
    expect(JSON.parse(listBody)).toMatchObject({ taskId: task.taskId, currentTaskRevision: task.revision, currentSnapshotId: task.latestSnapshotId,
      candidates: [expect.objectContaining({ candidateGenerationId, taskRevision: task.revision, sourceSnapshotMatchesCurrent: true })] });
    expect(listBody).not.toContain(root);
    for (const resource of ["knowledge-graph.json", "knowledge-base/wiki-index.json", "meta.json"]) {
      const pending = await fetch(new URL(`/${resource}?indexVersion=pending&indexGenerationId=${candidateGenerationId}`, url), { headers: { cookie } });
      const body = await pending.text();
      expect(pending.status, body).toBe(200);
      if (resource === "meta.json") expect(JSON.parse(body).knowledgeVersion).toMatchObject({ status: "pending", readOnly: true, evidenceEligible: false, taskId: task.taskId, generationId: candidateGenerationId });
    }
    let republished = false;
    let republicationCompleted = false;
    const openIndex = repositoryIndexer.openActiveRepositoryIndexV1;
    const openSpy = vi.spyOn(repositoryIndexer, "openActiveRepositoryIndexV1").mockImplementation(async (canonicalRoot) => {
      const index = await openIndex(canonicalRoot);
      return { ...index, async read(relativePath) {
        const bytes = await index.read(relativePath);
        if (!republished && relativePath === "knowledge-graph.json") {
          republished = true;
          await localRefreshIndexV1({ mode: "full", actor: "codex", idempotencyKey: "knowledge-same-snapshot-republication", expectedSourceSnapshotId: task.latestSnapshotId }, root);
          republicationCompleted = true;
        }
        return bytes;
      } };
    });
    try {
      const supersededPublication = await fetch(new URL(`/knowledge-graph.json?indexVersion=published&indexGenerationId=${active.generation.generationId}`, url), { headers: { cookie } });
      expect(republished).toBe(true);
      expect(republicationCompleted).toBe(true);
      expect(supersededPublication.status).toBe(503);
    } finally { openSpy.mockRestore(); }
    const republishedActive = await openIndex(root);
    expect(republishedActive.authority.finalizedProviderRevision).toBe(active.authority.finalizedProviderRevision + 1);
    const another: any = await callImplementedTool("build_task_brief", { task: "An independent Task for candidate scope rejection", expectedRevision: 0, actor: "codex", idempotencyKey: "other-knowledge-task" }, root, local);
    const otherOpened: any = await callImplementedTool("open_workbench", { route: { view: "tasks", taskId: another.structuredContent.result.task.taskId, section: "summary" } }, root, local);
    const otherUrl = new URL(otherOpened.structuredContent.result.deepLink);
    const otherLaunch = await fetch(new URL("/__workbench/launch", otherUrl), { method: "POST", headers: { "content-type": "application/json", origin: otherUrl.origin }, body: JSON.stringify({ token: otherUrl.hash.slice(1) }) });
    const otherCookie = otherLaunch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const crossTask = await fetch(new URL(`/knowledge-graph.json?indexVersion=pending&indexGenerationId=${candidateGenerationId}`, otherUrl), { headers: { cookie: otherCookie } });
    expect(crossTask.status).toBe(422);
    expect(() => assertRepositoryKnowledgeWriterReadyV1(candidate)).toThrow(/writer output/u);
    await expect(localRefreshIndexV1({ ...request, idempotencyKey: "knowledge-publish",
      knowledge: { ...request.knowledge, action: "publish", candidateGenerationId } }, root)).rejects.toThrow();
    await expect(localRefreshIndexV1({ ...request,
      knowledge: { ...request.knowledge, expectedTaskRevision: task.revision + 1 } }, root)).rejects.toThrow();
    await writeFile(path.join(root, "src/task.ts"), "export function task(): boolean { return false; }\n");
    await localRefreshIndexV1({ mode: "incremental", actor: "codex", idempotencyKey: "knowledge-source-advanced", expectedSourceSnapshotId: task.latestSnapshotId }, root);
    expect((await openIndex(root)).authority.finalizedProviderRevision).toBe(republishedActive.authority.finalizedProviderRevision + 1);
    const staleCandidate = await fetch(new URL(`/knowledge-graph.json?indexVersion=pending&indexGenerationId=${candidateGenerationId}`, url), { headers: { cookie } });
    expect(staleCandidate.status).toBe(409);
  }, 120_000);

  it("retains exact whole source for old snapshots and rejects wrong digests and tampered blobs", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    await localRefreshIndexV1({ mode: "full", actor: "codex", idempotencyKey: "source-init" }, root);
    const active = await openActiveRepositoryIndexV1(root);
    const sourceManifest = JSON.parse((await active.read("knowledge-base/.trace/source-manifest.json")).toString("utf8"));
    const source = sourceManifest.files.find((file: any) => file.filePath.endsWith(".ts"));
    const original = await readFile(path.join(root, source.filePath));
    await writeFile(path.join(root, source.filePath), "// current file now differs from baseline\n");
    const query = { canonicalRoot: root, sourceSnapshotId: active.authority.sourceSnapshotId, filePath: source.filePath };
    const pinnedSources = await openRepositoryIndexSourcesV1(query);
    expect(await pinnedSources.read(source.filePath)).toEqual(original);
    expect(await readRepositoryIndexSourceV1(query)).toEqual(original);
    expect(await readRepositoryIndexSourceV1({ ...query, contentDigest: `sha256:${createHash("sha256").update(original).digest("hex")}` })).toEqual(original);
    await expect(readRepositoryIndexSourceV1({ ...query, contentDigest: `sha256:${"0".repeat(64)}` })).rejects.toThrow(/digest/u);
    await writeFile(path.join(active.generationRoot, source.blobPath), "tampered\n");
    await expect(pinnedSources.read(source.filePath)).rejects.toThrow(/digest/u);
    await expect(readRepositoryIndexSourceV1(query)).rejects.toThrow(/digest/u);
  }, 120_000);
});
