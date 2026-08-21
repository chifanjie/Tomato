import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { GetTaskBriefResultV1Schema } from "@understand-code/contracts/mcp";

import {
  WorkbenchSessionError,
  openWorkbenchSessionV1,
} from "../src/index.js";

const roots: string[] = [];

const binding = (canonicalRoot: string) => ({
  canonicalRoot,
  productVersion: "0.1.0",
  repositoryId: "repo:test",
  worktreeId: "worktree:test",
  sourceSnapshotId: "snapshot:test",
  headCommit: null,
  worktreeFingerprint: `sha256:${"a".repeat(64)}` as `sha256:${string}`,
  freshness: "fresh" as const,
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("workbench runtime session", () => {
  it("starts a loopback session, emits a fragment token, and reuses identity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "workbench-runtime-"));
    roots.push(root);
    const first = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } },
      binding(root),
    );
    const token = first.output.structuredContent.result.deepLink.split("#")[1];
    expect(first.output.structuredContent.result.runtime.disposition).toBe("started");
    expect(first.output.structuredContent.result.deepLink).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/[^#]+#[A-Za-z0-9_-]+$/u);
    expect(token).toBeDefined();
    const deepLink = first.output.structuredContent.result.deepLink;
    const bootstrap = await fetch(deepLink.split("#")[0]!);
    expect(bootstrap.status).toBe(200);
    expect(bootstrap.headers.get("content-security-policy")).toContain("script-src 'self'");
    const script = await fetch(`http://127.0.0.1:${first.port}/__workbench/bootstrap.js`);
    expect(await script.text()).toContain("/__workbench/launch");
    const launch = await fetch(`http://127.0.0.1:${first.port}/__workbench/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(launch.status).toBe(200);
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const route = await fetch(`http://127.0.0.1:${first.port}/workbench`, { headers: { cookie } });
    expect(route.status).toBe(200);
    expect(route.headers.get("content-type")).toContain("text/html");
    expect(await route.text()).toContain("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    const replay = await fetch(`http://127.0.0.1:${first.port}/__workbench/launch`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }),
    });
    expect(replay.status).toBe(401);

    const second = await openWorkbenchSessionV1(
      { route: { view: "tasks" } },
      binding(root),
    );
    expect(second.output.structuredContent.result.runtime.disposition).toBe("reused");
    expect(second.port).toBe(first.port);
    await first.close();
  });

  it("pins redeemed browser sessions to their launch generation when the D-12 runtime is reused", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "workbench-runtime-generation-"));
    roots.push(root);
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const readerCalls: string[] = [];
    const trace = (
      generation: "g1" | "g2",
      input: {
        readonly taskId: string;
        readonly repositoryId: string;
        readonly worktreeId: string;
        readonly snapshotId: string;
      },
    ) => {
      readerCalls.push(`${generation}:${input.repositoryId}:${input.snapshotId}`);
      return {
        schemaVersion: 1 as const,
        surface: "trace" as const,
        taskId: input.taskId,
        repositoryId: input.repositoryId,
        worktreeId: input.worktreeId,
        snapshotId: input.snapshotId,
        status: "empty" as const,
        verification: {
          disposition: "externally_reported" as const,
          records: [],
          requiredCount: 0,
          passedCount: 0,
          failedCount: 0,
          pendingCount: 0,
        },
      };
    };
    const generationOne = {
      ...binding(root),
      repositoryId: "repo:g1",
      sourceSnapshotId: "snapshot:g1",
      worktreeFingerprint: `sha256:${"1".repeat(64)}` as `sha256:${string}`,
    };
    const first = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId } },
      {
        ...generationOne,
        traceReader: async (input) => trace("g1", input),
      },
    );
    const redeem = async (token: string): Promise<string> => {
      const response = await fetch(`http://127.0.0.1:${first.port}/__workbench/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      expect(response.status).toBe(200);
      return response.headers.get("set-cookie")!.split(";", 1)[0]!;
    };
    const readTrace = async (cookie: string) => {
      const response = await fetch(
        `http://127.0.0.1:${first.port}/__workbench/trace?taskId=${encodeURIComponent(taskId)}`,
        { headers: { cookie } },
      );
      expect(response.status).toBe(200);
      return response.json() as Promise<{ repositoryId: string; snapshotId: string }>;
    };

    const firstCookie = await redeem(
      first.output.structuredContent.result.deepLink.split("#")[1]!,
    );
    await expect(readTrace(firstCookie)).resolves.toMatchObject({
      repositoryId: "repo:g1",
      snapshotId: "snapshot:g1",
    });
    expect(readerCalls).toEqual(["g1:repo:g1:snapshot:g1"]);
    readerCalls.length = 0;

    const generationTwo = {
      ...binding(root),
      repositoryId: "repo:g2",
      sourceSnapshotId: "snapshot:g2",
      worktreeFingerprint: `sha256:${"2".repeat(64)}` as `sha256:${string}`,
    };
    const second = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId } },
      {
        ...generationTwo,
        traceReader: async (input) => trace("g2", input),
      },
    );
    expect(second.port).toBe(first.port);
    expect(second.output.structuredContent.result.runtime.disposition).toBe("reused");
    expect(second.output.structuredContent.meta).toMatchObject({
      repositoryId: "repo:g2",
      sourceSnapshotId: "snapshot:g2",
    });
    const secondCookie = await redeem(
      second.output.structuredContent.result.deepLink.split("#")[1]!,
    );

    await expect(readTrace(firstCookie)).resolves.toMatchObject({
      repositoryId: "repo:g1",
      snapshotId: "snapshot:g1",
    });
    await expect(readTrace(secondCookie)).resolves.toMatchObject({
      repositoryId: "repo:g2",
      snapshotId: "snapshot:g2",
    });
    expect(readerCalls).toEqual([
      "g2:repo:g1:snapshot:g1",
      "g2:repo:g2:snapshot:g2",
    ]);
    await first.close();
  });

  it("rejects relative roots and expires launch tokens without allowing replay", async () => {
    await expect(
      openWorkbenchSessionV1(
        { route: { view: "tasks" } },
        binding("relative/root"),
      ),
    ).rejects.toMatchObject({ code: "invalid_root" });

    const root = await mkdtemp(path.join(os.tmpdir(), "workbench-runtime-expiry-"));
    roots.push(root);
    let clock = 1_000;
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks" } },
      { ...binding(root), launchTokenTtlMs: 10, now: () => clock },
    );
    const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
    clock = 1_011;
    expect(() => session.redeemLaunchToken(token)).toThrowError(
      expect.objectContaining({ code: "launch_token_expired" }),
    );
    expect(() => session.redeemLaunchToken(token)).toThrowError(
      expect.objectContaining({ code: "launch_token_invalid" }),
    );
    await session.close();
  });

  it("serves an authenticated Task-first HTML shell and a contract-validated brief endpoint", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "workbench-runtime-task-"));
    roots.push(root);
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const result = GetTaskBriefResultV1Schema.parse({
      task: {
        schemaVersion: 1,
        taskId,
        title: "Task fixture",
        originalIntent: "Read the persisted Task Brief.",
        status: "created",
        repositoryId: "repo:test",
        worktreeId: "worktree:test",
        baselineSnapshotId: "snapshot:test",
        latestSnapshotId: "snapshot:test",
        createdAt: "2026-08-03T00:00:00.000Z",
        updatedAt: "2026-08-03T00:00:00.000Z",
        producerVersion: "0.1.0",
        revision: 1,
      },
      section: "summary",
      items: [{
        kind: "summary",
        originalIntent: "Read the persisted Task Brief.",
        goalClaimId: "claim:goal",
        acceptanceClaimCount: 0,
        plannedChangeCount: 0,
      }],
    });
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId, section: "summary" } },
      {
        ...binding(root),
        taskBriefReader: async (input) => input.section === "summary"
          ? { result, total: result.items.length }
          : undefined,
      },
    );
    const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
    const launch = await fetch(`http://127.0.0.1:${session.port}/__workbench/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const html = await fetch(`http://127.0.0.1:${session.port}/workbench`, { headers: { cookie } });
    expect(html.status).toBe(200);
    const htmlText = await html.text();
    expect(htmlText).toContain("Summary");
    expect(htmlText).toContain("/__workbench/app.js");
    expect(htmlText).toContain("Knowledge");
    const brief = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/task-brief?section=summary`,
      { headers: { cookie } },
    );
    expect(brief.status).toBe(200);
    expect((await brief.json() as { result: unknown }).result).toEqual(result);
    const unauthenticatedBrief = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/task-brief?section=summary`,
    );
    expect(unauthenticatedBrief.status).toBe(401);
    const unknownSection = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/task-brief?section=not-a-section`,
      { headers: { cookie } },
    );
    expect(unknownSection.status).toBe(409);
    const unknownTaskId = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
    const unknownSession = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId: unknownTaskId } },
      {
        ...binding(root),
        taskBriefReader: async (input) => input.taskId === taskId
          ? { result, total: result.items.length }
          : undefined,
      },
    );
    const unknownToken = unknownSession.output.structuredContent.result.deepLink.split("#")[1]!;
    const unknownLaunch = await fetch(`http://127.0.0.1:${session.port}/__workbench/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: unknownToken }),
    });
    const unknownCookie = unknownLaunch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const unknownTask = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/task-brief?section=summary`,
      { headers: { cookie: unknownCookie } },
    );
    expect([404, 409]).toContain(unknownTask.status);
    await session.close();
  });

  it("serves authenticated Task-bound Graph and Wiki projections and rejects mismatched callers", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "workbench-runtime-context-"));
    roots.push(root);
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId } },
      {
        ...binding(root),
        graphReader: async (input) => ({
          schemaVersion: 1,
          surface: "graph" as const,
          taskId: input.taskId,
          repositoryId: input.repositoryId,
          worktreeId: input.worktreeId,
          status: "ready" as const,
          artifact: {
            artifactPath: ".understand-code/knowledge-graph.json" as const,
            metadata: {
              version: "1",
              projectName: "fixture",
              analyzedAt: "2026-08-03T00:00:00.000Z",
              gitCommitHash: "abc",
            },
            counts: { nodes: 2, edges: 1, layers: 1, tour: 0 },
          },
        }),
        knowledgeReader: async (input) => ({
          schemaVersion: 1,
          surface: "knowledge" as const,
          taskId: input.taskId,
          repositoryId: input.repositoryId,
          worktreeId: input.worktreeId,
          status: "ready" as const,
          artifact: {
            artifactPath: ".understand-code/knowledge-base/wiki-index.json" as const,
            metadata: {
              version: 2,
              projectName: "fixture",
              generatedAt: "2026-08-03T00:00:00.000Z",
              readiness: "ready" as const,
            },
            counts: { pages: 3, nodeDocumentation: 2, evidence: 1 },
          },
        }),
      },
    );
    const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
    const launch = await fetch(`http://127.0.0.1:${session.port}/__workbench/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const graph = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/context?surface=graph`,
      { headers: { cookie } },
    );
    expect(graph.status).toBe(200);
    await expect(graph.json()).resolves.toMatchObject({
      surface: "graph",
      status: "ready",
      artifact: { counts: { nodes: 2, edges: 1 } },
    });
    const knowledge = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/context?surface=knowledge`,
      { headers: { cookie } },
    );
    expect(knowledge.status).toBe(200);
    await expect(knowledge.json()).resolves.toMatchObject({
      surface: "knowledge",
      status: "ready",
      artifact: { counts: { pages: 3, evidence: 1 } },
    });
    const unauthenticated = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/context?surface=graph`,
    );
    expect(unauthenticated.status).toBe(401);
    const mismatch = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/context?surface=graph&taskId=01ARZ3NDEKTSV4RRFFQ69G5FAW`,
      { headers: { cookie } },
    );
    expect(mismatch.status).toBe(409);
    await session.close();
  });

  it("serves authenticated Task-bound Change Check and Verification trace projection", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "workbench-runtime-trace-"));
    roots.push(root);
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId } },
      {
        ...binding(root),
        traceReader: async (input) => ({
          schemaVersion: 1,
          surface: "trace" as const,
          taskId: input.taskId,
          repositoryId: input.repositoryId,
          worktreeId: input.worktreeId,
          snapshotId: input.snapshotId,
          status: "ready" as const,
          changeCheck: {
            sourceArtifactId: "artifact:change_check:task",
            id: "change-check:task:1",
            taskId: input.taskId,
            taskRevision: 2,
            baselineSnapshotId: "snapshot:base",
            actualSnapshotId: input.snapshotId,
            generatedAt: "2026-08-03T00:00:00.000Z",
            findings: [
              {
                id: "finding:1",
                type: "planned_completed",
                severity: "warning",
                blocking: true,
                resolution: "unresolved" as const,
              },
            ],
            counts: { total: 1, blocking: 1, openBlocking: 1 },
          },
          verification: {
            disposition: "externally_reported" as const,
            records: [
              {
                sourceArtifactId: "artifact:verification:task",
                sourceRecordId: "verification:task:1",
                taskId: input.taskId,
                verificationPlanEntryId: "verification-plan:1",
                attempt: 1,
                method: "test" as const,
                status: "passed" as const,
                claimIds: ["claim:1"],
                snapshotId: input.snapshotId,
                recordedAt: "2026-08-03T00:00:00.000Z",
                detailStatus: "legacy_redacted" as const,
                disposition: "externally_reported" as const,
              },
            ],
            requiredCount: 1,
            passedCount: 1,
            failedCount: 0,
            pendingCount: 0,
          },
        }),
      },
    );
    const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
    const launch = await fetch(`http://127.0.0.1:${session.port}/__workbench/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const html = await fetch(`http://127.0.0.1:${session.port}/workbench`, { headers: { cookie } });
    expect(await html.text()).toContain("Trace");
    const trace = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/trace?taskId=${encodeURIComponent(taskId)}`,
      { headers: { cookie } },
    );
    expect(trace.status).toBe(200);
    await expect(trace.json()).resolves.toMatchObject({
      surface: "trace",
      status: "ready",
      verification: {
        disposition: "externally_reported",
        records: [
          {
            detailStatus: "legacy_redacted",
            disposition: "externally_reported",
          },
        ],
      },
    });
  });

  it("serves a session-bound Evidence to Source projection with fail-closed states", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "workbench-runtime-evidence-"));
    roots.push(root);
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const calls: Array<{
      taskId: string;
      evidenceId: string;
      repositoryId: string;
      worktreeId: string;
      snapshotId: string;
      headCommit: string | null;
    }> = [];
    const digest = `sha256:${"b".repeat(64)}` as `sha256:${string}`;
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId } },
      {
        ...binding(root),
        evidenceReader: async (input) => {
          calls.push(input);
          const base = {
            schemaVersion: 1 as const,
            surface: "evidence" as const,
            taskId: input.taskId,
            evidenceId: input.evidenceId,
            repositoryId: input.repositoryId,
            worktreeId: input.worktreeId,
            snapshotId: input.snapshotId,
            headCommit: input.headCommit,
          };
          if (input.evidenceId === "evidence:ready") {
            return {
              ...base,
              status: "ready" as const,
              evidence: {
                id: input.evidenceId,
                kind: "source" as const,
                epistemicStatus: "observed" as const,
                freshness: "current" as const,
                filePath: "src/example.ts",
                lineRange: [1, 1] as [number, number],
                contentHash: digest,
                observedAtSnapshotId: input.snapshotId,
              },
              source: {
                filePath: "src/example.ts",
                lineRange: [1, 1] as [number, number],
                content: "export const answer = 42;",
                sizeBytes: 25,
                lineCount: 1,
                truncated: false as const,
              },
            };
          }
          if (input.evidenceId === "evidence:stale") {
            return {
              ...base,
              status: "stale" as const,
              reason: "evidence_stale" as const,
              observedSnapshotId: "snapshot:old",
            };
          }
          if (input.evidenceId === "evidence:secret") {
            return {
              ...base,
              status: "ready" as const,
              evidence: {
                id: input.evidenceId,
                kind: "config" as const,
                epistemicStatus: "observed" as const,
                freshness: "current" as const,
                filePath: ".env",
                lineRange: [1, 1] as [number, number],
                contentHash: digest,
                observedAtSnapshotId: input.snapshotId,
              },
              source: {
                filePath: ".env",
                lineRange: [1, 1] as [number, number],
                content: "TOKEN=do-not-leak",
                sizeBytes: 17,
                lineCount: 1,
                truncated: false as const,
              },
            };
          }
          return undefined;
        },
      },
    );
    const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
    const launch = await fetch(`http://127.0.0.1:${session.port}/__workbench/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(launch.status).toBe(200);
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const html = await fetch(`http://127.0.0.1:${session.port}/workbench`, { headers: { cookie } });
    const htmlText = await html.text();
    expect(htmlText).toContain("Evidence / Source");
    expect(htmlText).toContain("wb-actions");
    const evidenceRoute = await fetch(
      `http://127.0.0.1:${session.port}/workbench?view=tasks&taskId=${taskId}&section=summary&evidenceId=${encodeURIComponent("evidence:ready")}`,
      { headers: { cookie } },
    );
    expect(evidenceRoute.status).toBe(200);
    expect(await evidenceRoute.text()).toContain('data-evidence-id="evidence:ready"');

    const ready = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/evidence?taskId=${taskId}&evidenceId=evidence%3Aready`,
      { headers: { cookie } },
    );
    expect(ready.status).toBe(200);
    await expect(ready.json()).resolves.toMatchObject({
      status: "ready",
      evidence: { filePath: "src/example.ts", lineRange: [1, 1] },
      source: { content: "export const answer = 42;" },
    });
    expect(calls[0]).toMatchObject({
      taskId,
      evidenceId: "evidence:ready",
      repositoryId: "repo:test",
      worktreeId: "worktree:test",
      snapshotId: "snapshot:test",
      headCommit: null,
    });

    const stale = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/evidence?taskId=${taskId}&evidenceId=evidence%3Astale`,
      { headers: { cookie } },
    );
    expect(stale.status).toBe(200);
    await expect(stale.json()).resolves.toMatchObject({ status: "stale", reason: "evidence_stale", observedSnapshotId: "snapshot:old" });

    const redacted = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/evidence?taskId=${taskId}&evidenceId=evidence%3Asecret`,
      { headers: { cookie } },
    );
    expect(redacted.status).toBe(200);
    const redactedPayload = await redacted.json() as { status: string; source?: unknown; evidence?: unknown };
    expect(redactedPayload).toMatchObject({ status: "redacted" });
    expect(redactedPayload.source).toBeUndefined();
    expect(redactedPayload.evidence).toBeUndefined();

    const unavailable = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/evidence?taskId=${taskId}&evidenceId=evidence%3Amissing`,
      { headers: { cookie } },
    );
    expect(unavailable.status).toBe(200);
    await expect(unavailable.json()).resolves.toMatchObject({ status: "unavailable", reason: "not_published" });

    const extraInput = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/evidence?taskId=${taskId}&evidenceId=evidence%3Aready&path=src%2Fexample.ts`,
      { headers: { cookie } },
    );
    expect(extraInput.status).toBe(409);
    const mismatch = await fetch(
      "http://127.0.0.1:" + session.port + "/__workbench/evidence?taskId=01ARZ3NDEKTSV4RRFFQ69G5FAW&evidenceId=evidence%3Aready",
      { headers: { cookie } },
    );
    expect(mismatch.status).toBe(409);
    const unauthenticated = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/evidence?taskId=${taskId}&evidenceId=evidence%3Aready`,
    );
    expect(unauthenticated.status).toBe(401);
    await session.close();
  });
});
