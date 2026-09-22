import { writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { callImplementedTool } from "../src/handlers/tools.js";
import { cleanupTemporaryDirectories, createGitRepository } from "./helpers.js";
import { closeAllWorkbenchSessionsV1 } from "@understand-code/workbench-runtime";
import { openRuntime } from "../src/runtime/context.js";
import { RepositoryTaskContextProvider } from "@understand-code/task-engine";
import { openActiveRepositoryIndexV1, readRepositoryIndexSourceV1 } from "../src/runtime/repository-indexer.js";
afterEach(async () => { await closeAllWorkbenchSessionsV1(); await cleanupTemporaryDirectories(); });
const local = { runtimeProfile: "local_durable_v1" as const };
describe("supported local durable runtime", () => {
  it("reports exact Task revision conflicts after rejected gates and concurrent mutations", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const created: any = await callImplementedTool("build_task_brief", { task: "Check revision recovery", expectedRevision: 0, actor: "codex", idempotencyKey: "revision-task" }, root, local);
    expect(created.isError, JSON.stringify(created)).toBe(false);
    const { task, brief } = created.structuredContent.result;
    const update = (expectedRevision: number, idempotencyKey: string, action: unknown) => callImplementedTool("update_task", { taskId: task.taskId, actor: "codex", expectedRevision, idempotencyKey, action }, root, local) as Promise<any>;
    const rejected = await update(task.revision, "unconfirmed-plan", { type: "transition_status", to: "planned" });
    expect(rejected.structuredContent.error.code).toBe("task_gate_unsatisfied");
    for (const expectedRevision of [task.revision + 1, task.revision - 1]) {
      const conflict = await update(expectedRevision, `wrong-revision-${expectedRevision}`, { type: "transition_status", to: "in_progress" });
      expect(conflict.structuredContent.error).toEqual({ schemaVersion: 1, code: "revision_conflict", details: {
        taskId: task.taskId, expectedRevision, actualRevision: task.revision,
      } });
      expect(conflict.content[0].text).toContain("get_task_brief");
    }
    const results = await Promise.all(["first", "second"].map((key) => update(task.revision, `concurrent-goal-${key}`, { type: "confirm_goal", claimId: brief.goalClaimId })));
    expect(results.filter((result) => result.isError !== true)).toHaveLength(1);
    expect(results.find((result) => result.isError === true)?.structuredContent.error).toEqual({ schemaVersion: 1, code: "revision_conflict", details: {
      taskId: task.taskId, expectedRevision: task.revision, actualRevision: task.revision + 1,
    } });
    const after: any = await callImplementedTool("get_task_brief", { taskId: task.taskId, section: "summary" }, root, local);
    expect(after.structuredContent.result.task.revision).toBe(task.revision + 1);
    expect(after.structuredContent.result.task.status).toBe(task.status);
  }, 60_000);

  it("persists a real Git Task, opens evidence, checks an edit and records an executed test", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const created: any = await callImplementedTool("build_task_brief", { expectedRevision: 0, task: "Explain the task function return value and its callers", actor: "codex", idempotencyKey: "local-create-1" }, root, local);
    expect(created, JSON.stringify(created)).toMatchObject({ isError: false });
    const task = created.structuredContent.result.task;
    const reopened = await openRuntime(root);
    const persisted = await reopened.store.readTaskBundle(task.taskId);
    expect(persisted.bundle.manifest.taskId).toBe(task.taskId);
    expect("evidence" in persisted.bundle && persisted.bundle.evidence.length).toBeGreaterThan(0);
    expect("evidence" in persisted.bundle && persisted.bundle.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "source", filePath: "src/task.ts", epistemicStatus: "observed" }),
    ]));
    const replay: any = await callImplementedTool("build_task_brief", { expectedRevision: 0, task: "Explain the task function return value and its callers", actor: "codex", idempotencyKey: "local-create-1" }, root, local);
    expect(replay.structuredContent.result.task.taskId).toBe(task.taskId);
    const read: any = await callImplementedTool("get_task_brief", { taskId: task.taskId, section: "summary" }, root, local);
    expect(read, JSON.stringify(read)).toMatchObject({ isError: false });
    const search: any = await callImplementedTool("search_context", { taskId: task.taskId, query: "task" }, root, local);
    expect(search, JSON.stringify(search)).toMatchObject({ isError: false });
    expect(search.structuredContent.result.results.length).toBeGreaterThan(0);
    const symbols: any = await callImplementedTool("search_context", { taskId: task.taskId, query: "task", scopes: ["symbol"], pathPrefixes: ["src"] }, root, local);
    expect(symbols.isError, JSON.stringify(symbols)).toBe(false);
    expect(symbols.structuredContent.result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "symbol", filePath: "src/task.ts", symbolId: expect.any(String), evidenceIds: expect.arrayContaining([expect.any(String)]) }),
    ]));
    for (const symbol of symbols.structuredContent.result.results) {
      const evidence: any = await callImplementedTool("get_evidence", { taskId: task.taskId, evidenceIds: symbol.evidenceIds }, root, local);
      expect(evidence.isError, JSON.stringify(evidence)).toBe(false);
      expect(JSON.stringify(evidence)).toContain(symbol.symbolId);
    }
    const excluded: any = await callImplementedTool("search_context", { taskId: task.taskId, query: "task", scopes: ["symbol"], pathPrefixes: ["other"] }, root, local);
    expect(excluded.structuredContent.result.results).toEqual([]);

    const opened: any = await callImplementedTool("open_workbench", { route: { view: "tasks", taskId: task.taskId, section: "summary" } }, root, local);
    expect(opened.isError, JSON.stringify(opened)).not.toBe(true);
    const url = new URL(opened.structuredContent.result.deepLink);
    const launch = await fetch(new URL("/__workbench/launch", url), { method: "POST", headers: { "content-type": "application/json", origin: url.origin }, body: JSON.stringify({ token: url.hash.slice(1) }) });
    expect(launch.status).toBeLessThan(400);
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const discovery = await fetch(new URL("/__workbench/tasks", url), { headers: { cookie } });
    const discoveryBody = await discovery.text();
    expect(discovery.status, discoveryBody).toBe(200);
    expect(discoveryBody).not.toContain(root);
    const discoveryJson = JSON.parse(discoveryBody) as { tasks: unknown[]; repository: { name?: string } };
    expect(discoveryJson.repository.name).toBe(path.basename(root));
    expect(discoveryJson.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ taskId: task.taskId })]));
    const brief = await fetch(new URL(`/tasks/${encodeURIComponent(task.taskId)}/brief.json?section=summary`, url), { headers: { cookie } });
    expect(brief.status).toBe(200);
    expect(((await brief.json()) as { claims: unknown[] }).claims.length).toBeGreaterThan(0);
    const reopenLink = await fetch(new URL(`/__workbench/tasks/${encodeURIComponent(task.taskId)}/open`, url), { headers: { cookie } });
    expect(reopenLink.status).toBe(200);
    expect(((await reopenLink.json()) as { deepLink: string }).deepLink).toContain("/workbench");
    let revision = task.revision;
    const mutate = async (action: unknown, key: string) => {
      const result: any = await callImplementedTool("update_task", { taskId: task.taskId, expectedRevision: revision, actor: "codex", idempotencyKey: key, action }, root, local);
      expect(result.isError, JSON.stringify(result)).not.toBe(true);
      revision = result.structuredContent.result.mutation.revision;
      return result.structuredContent.result;
    };
    const taskBrief = created.structuredContent.result.brief;
    await mutate({ type: "confirm_goal", claimId: taskBrief.goalClaimId }, "local-goal");
    await mutate({ type: "confirm_acceptance_criteria", claimIds: taskBrief.acceptanceClaimIds }, "local-acceptance");
    await mutate({ type: "confirm_plan", plannedChangeIds: taskBrief.plannedChanges.map((entry: any) => entry.id) }, "local-plan");
    await mutate({ type: "transition_status", to: "planned" }, "local-planned");
    await mutate({ type: "transition_status", to: "in_progress" }, "local-progress");
    await writeFile(path.join(root, "src/task.ts"), "export function task(): boolean { return false; }\n");
    const priorSnapshot = await reopened.store.readArtifact("repository_snapshot", { snapshotId: task.latestSnapshotId });
    if (priorSnapshot.artifact.artifactType !== "repository_snapshot") throw new Error("Expected repository snapshot");
    const activeIndex = await openActiveRepositoryIndexV1(root);
    const prefix = path.relative(root, activeIndex.generationRoot);
    const provider = await RepositoryTaskContextProvider.open({
      canonicalRoot: root,
      graphPath: `${prefix}/knowledge-graph.json`,
      wikiIndexPath: `${prefix}/knowledge-base/wiki-index.json`,
      wikiSearchPath: `${prefix}/knowledge-base/search-index.json`,
      readLocalSnapshotSource: (input) => readRepositoryIndexSourceV1({ canonicalRoot: root, ...input }),
    });
    const drifted = await provider.loadTaskContext({ intent: "Explain task", sourceSnapshotId: task.latestSnapshotId, repositorySnapshot: priorSnapshot.artifact.payload });
    expect(drifted.sourceEvidence?.some((item) => item.filePath === "src/task.ts") ?? false).toBe(false);
    const refresh: any = await callImplementedTool("refresh_index", { mode: "incremental", actor: "codex", idempotencyKey: "local-edited", expectedSourceSnapshotId: task.latestSnapshotId }, root, local);
    expect(refresh.isError, JSON.stringify(refresh)).not.toBe(true);
    const actualSnapshotId = refresh.structuredContent.meta.sourceSnapshotId;
    await mutate({ type: "transition_status", to: "check_required" }, "local-check-required");
    const checked: any = await callImplementedTool("check_change", { taskId: task.taskId, actualSnapshotId, includeWorktree: true, expectedRevision: revision, actor: "codex", idempotencyKey: "local-check" }, root, local);
    expect(checked.isError, JSON.stringify(checked)).not.toBe(true);
    revision = checked.structuredContent.result.mutation.revision;
    for (const finding of checked.structuredContent.result.changeCheck.findings.filter((entry: any) => entry.blocking)) await mutate({ type: "accept_finding", findingId: finding.id, reason: "Integration test explicitly accepts the bounded static-analysis gap before executing its real assertion." }, `local-accept-${finding.id}`);
    await mutate({ type: "transition_status", to: "verification_required" }, "local-verification-required");
    const plan = taskBrief.verificationPlan[0];
    const started = Date.now();
    await promisify(execFile)(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", "import {task} from './src/task.ts'; if(task() !== false) throw new Error('unexpected result')"], { cwd: root });
    const recorded: any = await callImplementedTool("record_verification", { taskId: task.taskId, expectedRevision: revision, actor: "codex", idempotencyKey: "local-verification", record: { verificationPlanEntryId: plan.id, kind: plan.method, status: "passed", command: "node --experimental-strip-types: import task and assert task() === false", exitCode: 0, durationMs: Date.now() - started, summary: "Executed assertion against the actual changed repository source.", claimIds: plan.acceptanceClaimIds, snapshotId: actualSnapshotId } }, root, local);
    expect(recorded.isError, JSON.stringify(recorded)).not.toBe(true);
    expect(recorded.structuredContent.result.verification.status).toBe("passed");


  }, 120_000);
});
