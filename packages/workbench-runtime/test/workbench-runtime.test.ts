import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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
    expect((await route.json() as { route: { taskId?: string } }).route.taskId).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
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
});
