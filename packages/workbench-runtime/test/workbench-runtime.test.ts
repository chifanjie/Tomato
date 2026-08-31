import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { GetTaskBriefResultV1Schema } from "@understand-code/contracts/mcp";

import {
  LEGACY_EMBEDDED_READ_ONLY_WORKBENCH_UI_V1,
  WorkbenchSessionError,
  openWorkbenchSessionV1,
  type WorkbenchDashboardReadRequestV1,
} from "../src/index.js";

const roots: string[] = [];

const DASHBOARD_INDEX = '<!doctype html><html><body><div id="root" data-dashboard="react"></div><script type="module" src="/assets/index-test.js"></script></body></html>';
const DASHBOARD_ASSET = "window.__UNDERSTAND_CODE_REACT_DASHBOARD__ = true;";

function digest(value: string | Buffer): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function dashboardBundle(root: string) {
  const inventory = [
    {
      path: "assets/index-test.js",
      sha256: digest(DASHBOARD_ASSET),
      bytes: Buffer.byteLength(DASHBOARD_ASSET, "utf8"),
    },
    {
      path: "index.html",
      sha256: digest(DASHBOARD_INDEX),
      bytes: Buffer.byteLength(DASHBOARD_INDEX, "utf8"),
    },
  ];
  return {
    root: path.join(root, "dashboard"),
    productVersion: "0.1.0",
    fileCount: inventory.length,
    inventorySha256: digest(JSON.stringify(inventory)),
  };
}

async function runtimeRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  roots.push(root);
  const dashboardRoot = path.join(root, "dashboard");
  await mkdir(path.join(dashboardRoot, "assets"), { recursive: true });
  await Promise.all([
    writeFile(path.join(dashboardRoot, "index.html"), DASHBOARD_INDEX),
    writeFile(path.join(dashboardRoot, "assets/index-test.js"), DASHBOARD_ASSET),
  ]);
  return root;
}

const binding = (canonicalRoot: string) => ({
  canonicalRoot,
  productVersion: "0.1.0",
  repositoryId: "repo:test",
  worktreeId: "worktree:test",
  sourceSnapshotId: "snapshot:test",
  headCommit: null,
  worktreeFingerprint: `sha256:${"a".repeat(64)}` as `sha256:${string}`,
  freshness: "fresh" as const,
  dashboardBundle: dashboardBundle(canonicalRoot),
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("workbench runtime session", () => {
  it("starts a loopback session, emits a fragment token, and reuses identity", async () => {
    const root = await runtimeRoot("workbench-runtime-");
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
    const staleRuntimeCookie = await fetch(deepLink.split("#")[0]!, {
      headers: { cookie: "workbench_session=stopped-runtime-session" },
    });
    expect(staleRuntimeCookie.status).toBe(200);
    expect(await staleRuntimeCookie.text()).toContain("/__workbench/bootstrap.js");
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
    expect(await route.text()).toBe(DASHBOARD_INDEX);
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

  it("enables the embedded UI only explicitly and keeps React sessions fail-closed and mode-bound", async () => {
    const root = await runtimeRoot("workbench-runtime-legacy-");
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const reactBinding = binding(root);
    await expect(
      openWorkbenchSessionV1(
        { route: { view: "tasks", taskId } },
        { ...reactBinding, dashboardBundle: undefined } as unknown as Parameters<
          typeof openWorkbenchSessionV1
        >[1],
      ),
    ).rejects.toMatchObject({ code: "invalid_identity" });

    const react = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId } },
      reactBinding,
    );
    const { dashboardBundle: _omittedDashboardBundle, ...legacyBinding } = reactBinding;
    const legacy = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId } },
      {
        ...legacyBinding,
        workbenchUi: LEGACY_EMBEDDED_READ_ONLY_WORKBENCH_UI_V1,
      },
    );
    expect(legacy.output.structuredContent.result.runtime.disposition).toBe("started");
    expect(legacy.port).not.toBe(react.port);

    const token = legacy.output.structuredContent.result.deepLink.split("#")[1]!;
    const launch = await fetch(`http://127.0.0.1:${legacy.port}/__workbench/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const headers = { cookie };
    const workbench = await fetch(`http://127.0.0.1:${legacy.port}/workbench`, { headers });
    expect(await workbench.text()).toContain(
      `data-workbench-ui="${LEGACY_EMBEDDED_READ_ONLY_WORKBENCH_UI_V1}"`,
    );
    const task = await fetch(`http://127.0.0.1:${legacy.port}/tasks/${taskId}`, { headers });
    expect(await task.text()).toContain("/__workbench/app.js");
    const embeddedApp = await fetch(
      `http://127.0.0.1:${legacy.port}/__workbench/app.js`,
      { headers },
    );
    const embeddedAppText = await embeddedApp.text();
    expect(embeddedAppText).toContain("legacy summary findings are not clean evidence");
    expect(embeddedAppText).toContain("Empty findings are clean evidence");
    const reactAsset = await fetch(
      `http://127.0.0.1:${legacy.port}/assets/index-test.js`,
      { headers },
    );
    expect(reactAsset.status).toBe(404);
    await expect(reactAsset.json()).resolves.toEqual({ error: "not_found" });

    await Promise.all([react.close(), legacy.close()]);
  });

  it("pins redeemed browser sessions to their launch generation when the D-12 runtime is reused", async () => {
    const root = await runtimeRoot("workbench-runtime-generation-");
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

  it("serves the packed React bundle and Preview-compatible data routes through the cookie gateway", async () => {
    const root = await runtimeRoot("workbench-runtime-dashboard-");
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const calls: WorkbenchDashboardReadRequestV1[] = [];
    let graphIsStale = false;
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId, section: "summary" } },
      {
        ...binding(root),
        dashboardReader: async (input) => {
          calls.push(input);
          if (input.kind === "graph" && graphIsStale) return { status: "stale" };
          if (input.kind === "wiki_page") {
            return {
              status: "ready",
              text: "# Overview\n",
              contentType: "text/markdown; charset=utf-8",
            };
          }
          return {
            status: "ready",
            json: input.kind === "task_brief"
              ? { task: { taskId: input.taskId }, section: input.section }
              : { kind: input.kind },
          };
        },
      },
    );
    const base = `http://127.0.0.1:${session.port}`;
    const token = session.output.structuredContent.result.deepLink.split("#")[1]!;

    const tokenOnlyAsset = await fetch(`${base}/assets/index-test.js?token=${token}`);
    expect(tokenOnlyAsset.status).toBe(401);
    const tokenOnlyGraph = await fetch(`${base}/knowledge-graph.json?token=${token}`);
    expect(tokenOnlyGraph.status).toBe(401);

    const launch = await fetch(`${base}/__workbench/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(launch.status).toBe(200);
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const headers = { cookie };

    const index = await fetch(`${base}/workbench?view=tasks&taskId=${taskId}&section=summary`, { headers });
    expect(index.status).toBe(200);
    expect(await index.text()).toBe(DASHBOARD_INDEX);
    const asset = await fetch(`${base}/assets/index-test.js`, { headers });
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe(DASHBOARD_ASSET);
    const taskIndex = await fetch(`${base}/tasks/${taskId}`, { headers });
    expect(await taskIndex.text()).toBe(DASHBOARD_INDEX);
    const taskRoute = await fetch(`${base}/tasks/${taskId}`, {
      headers: { ...headers, accept: "application/json" },
    });
    await expect(taskRoute.json()).resolves.toMatchObject({ route: { taskId, section: "summary" } });

    const jsonRoutes = [
      "/knowledge-graph.json",
      "/meta.json",
      "/config.json",
      "/knowledge-base/wiki-index.json",
      "/knowledge-base/search-index.json",
      `/tasks/${taskId}/brief.json?section=summary`,
      `/tasks/${taskId}/change-check.json`,
      `/tasks/${taskId}/verification.json`,
    ];
    for (const route of jsonRoutes) {
      const response = await fetch(`${base}${route}`, { headers });
      expect(response.status, route).toBe(200);
      expect(response.headers.get("content-type"), route).toContain("application/json");
    }
    const page = await fetch(`${base}/knowledge-base/Overview.md`, { headers });
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(await page.text()).toBe("# Overview\n");

    expect(calls.map((call) => call.kind)).toEqual([
      "graph",
      "meta",
      "config",
      "wiki_index",
      "wiki_search",
      "task_brief",
      "task_change_check",
      "task_verification",
      "wiki_page",
    ]);
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        repositoryId: "repo:test",
        worktreeId: "worktree:test",
        sourceSnapshotId: "snapshot:test",
        headCommit: null,
        route: expect.objectContaining({ taskId }),
      }),
      expect.objectContaining({ kind: "wiki_page", relativePath: "knowledge-base/Overview.md" }),
      expect.objectContaining({ kind: "task_brief", taskId, section: "summary" }),
    ]));
    for (const call of calls) {
      expect(call).not.toHaveProperty("indexVersion");
      expect(call).not.toHaveProperty("indexGenerationId");
    }

    graphIsStale = true;
    const stale = await fetch(`${base}/knowledge-graph.json`, { headers });
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toEqual({ error: "dashboard_resource_stale" });
    await session.close();
  });

  it("maps explicit published knowledge selectors without changing the browser binding", async () => {
    const root = await runtimeRoot("workbench-runtime-published-");
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const generationId = `generation-${"a".repeat(64)}`;
    const calls: WorkbenchDashboardReadRequestV1[] = [];
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId, section: "summary" } },
      {
        ...binding(root),
        dashboardReader: async (input) => {
          calls.push(input);
          return input.kind === "wiki_page"
            ? { status: "ready", text: "# Published\n", contentType: "text/markdown; charset=utf-8" }
            : { status: "ready", json: { kind: input.kind } };
        },
      },
    );
    try {
      const base = `http://127.0.0.1:${session.port}`;
      const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
      const launch = await fetch(`${base}/__workbench/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const headers = { cookie: launch.headers.get("set-cookie")!.split(";", 1)[0]! };
      const routes = [
        ["/knowledge-graph.json", "graph"],
        ["/meta.json", "meta"],
        ["/knowledge-base/wiki-index.json", "wiki_index"],
        ["/knowledge-base/search-index.json", "wiki_search"],
        ["/knowledge-base/Overview.md", "wiki_page"],
      ] as const;
      for (const [route, kind] of routes) {
        const response = await fetch(`${base}${route}?indexVersion=published&indexGenerationId=${generationId}`, { headers });
        expect(response.status, route).toBe(200);
        expect(calls.at(-1)).toEqual({
          productVersion: "0.1.0",
          repositoryId: "repo:test",
          worktreeId: "worktree:test",
          sourceSnapshotId: "snapshot:test",
          headCommit: null,
          freshness: "fresh",
          route: { view: "tasks", taskId, section: "summary" },
          kind,
          indexVersion: "published",
          indexGenerationId: generationId,
          ...(kind === "wiki_page" ? { relativePath: "knowledge-base/Overview.md" } : {}),
        });
      }
      const meta = await fetch(`${base}/meta.json?indexVersion=published`, { headers });
      expect(meta.status).toBe(200);
      expect(calls.at(-1)).toMatchObject({ kind: "meta", indexVersion: "published" });
      expect(calls.at(-1)).not.toHaveProperty("indexGenerationId");
      const unauthenticated = await fetch(`${base}/meta.json?indexVersion=published`);
      expect(unauthenticated.status).toBe(401);
      expect(calls).toHaveLength(routes.length + 1);
    } finally {
      await session.close();
    }
  });

  it("rejects malformed, unpinned, and out-of-scope published knowledge selectors before reading", async () => {
    const root = await runtimeRoot("workbench-runtime-published-invalid-");
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const generationId = `generation-${"b".repeat(64)}`;
    const calls: WorkbenchDashboardReadRequestV1[] = [];
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId, section: "summary" } },
      {
        ...binding(root),
        dashboardReader: async (input) => {
          calls.push(input);
          return { status: "ready", json: {} };
        },
      },
    );
    try {
      const base = `http://127.0.0.1:${session.port}`;
      const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
      const launch = await fetch(`${base}/__workbench/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const headers = { cookie: launch.headers.get("set-cookie")!.split(";", 1)[0]! };
      const selector = `indexVersion=published&indexGenerationId=${generationId}`;
      const invalidQueries = [
        "indexVersion=",
        "indexVersion=current",
        "indexVersion=historical",
        "indexVersion=Published",
        `indexGenerationId=${generationId}`,
        "indexVersion=published&indexGenerationId=",
        `indexVersion=published&indexGenerationId=generation-${"B".repeat(64)}`,
        `indexVersion=published&indexGenerationId=generation-${"b".repeat(63)}`,
        `indexVersion=published&indexGenerationId=generation-${"b".repeat(65)}`,
        "indexVersion=published&indexGenerationId=..%2Fsecret",
        `${selector}&indexVersion=published`,
        `${selector}&indexGenerationId=${generationId}`,
        ...["root", "canonicalRoot", "repositoryId", "worktreeId", "sourceSnapshotId", "session", "token", "extra"]
          .map((name) => `${selector}&${name}=override`),
      ];
      const invalidRoutes = [
        ...invalidQueries.map((query) => `/meta.json?${query}`),
        ...["/knowledge-graph.json", "/knowledge-base/wiki-index.json", "/knowledge-base/search-index.json", "/knowledge-base/Overview.md"]
          .map((route) => `${route}?indexVersion=published`),
        ...["/config.json", `/tasks/${taskId}/brief.json`, `/tasks/${taskId}/change-check.json`, `/tasks/${taskId}/verification.json`,
          "/__workbench/task-brief", "/__workbench/context?surface=graph", "/__workbench/trace", `/tasks/${taskId}`,
          `/workbench?view=tasks&taskId=${taskId}`]
          .map((route) => `${route}${route.includes("?") ? "&" : "?"}${selector}`),
      ];
      for (const route of invalidRoutes) {
        const response = await fetch(`${base}${route}`, { headers });
        expect(response.status, route).toBe(409);
        await expect(response.json(), route).resolves.toEqual({ error: "dashboard_route_invalid" });
      }
      expect(calls).toEqual([]);
    } finally {
      await session.close();
    }
  });

  it("maps exact pending knowledge selectors using only the session Task binding", async () => {
    const root = await runtimeRoot("workbench-runtime-pending-");
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const generationId = `generation-${"c".repeat(64)}`;
    const calls: WorkbenchDashboardReadRequestV1[] = [];
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId, section: "summary" } },
      {
        ...binding(root),
        dashboardReader: async (input) => {
          calls.push(input);
          return input.kind === "wiki_page"
            ? { status: "ready", text: "# Pending\n", contentType: "text/markdown; charset=utf-8" }
            : { status: "ready", json: { kind: input.kind } };
        },
      },
    );
    try {
      const base = `http://127.0.0.1:${session.port}`;
      const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
      const launch = await fetch(`${base}/__workbench/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const headers = { cookie: launch.headers.get("set-cookie")!.split(";", 1)[0]! };
      const routes = [
        ["/knowledge-graph.json", "graph"],
        ["/meta.json", "meta"],
        ["/knowledge-base/wiki-index.json", "wiki_index"],
        ["/knowledge-base/search-index.json", "wiki_search"],
        ["/knowledge-base/Overview.md", "wiki_page"],
      ] as const;
      for (const [route, kind] of routes) {
        const response = await fetch(`${base}${route}?indexVersion=pending&indexGenerationId=${generationId}`, { headers });
        expect(response.status, route).toBe(200);
        expect(calls.at(-1)).toEqual({
          productVersion: "0.1.0",
          repositoryId: "repo:test",
          worktreeId: "worktree:test",
          sourceSnapshotId: "snapshot:test",
          headCommit: null,
          freshness: "fresh",
          route: { view: "tasks", taskId, section: "summary" },
          kind,
          indexVersion: "pending",
          indexGenerationId: generationId,
          ...(kind === "wiki_page" ? { relativePath: "knowledge-base/Overview.md" } : {}),
        });
      }
      const selector = `indexVersion=pending&indexGenerationId=${generationId}`;
      expect((await fetch(`${base}/meta.json?${selector}`)).status).toBe(401);
      expect((await fetch(`${base}/meta.json?${selector}`, {
        headers: { cookie: "workbench_session=invalid" },
      })).status).toBe(401);
      expect(calls).toHaveLength(routes.length);
    } finally {
      await session.close();
    }
  });

  it("rejects malformed, unpinned, and out-of-scope pending selectors before reading", async () => {
    const root = await runtimeRoot("workbench-runtime-pending-invalid-");
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const generationId = `generation-${"c".repeat(64)}`;
    const calls: WorkbenchDashboardReadRequestV1[] = [];
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId } },
      { ...binding(root), dashboardReader: async (input) => {
        calls.push(input);
        return { status: "ready", json: {} };
      } },
    );
    try {
      const base = `http://127.0.0.1:${session.port}`;
      const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
      const launch = await fetch(`${base}/__workbench/launch`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }),
      });
      const headers = { cookie: launch.headers.get("set-cookie")!.split(";", 1)[0]! };
      const selector = `indexVersion=pending&indexGenerationId=${generationId}`;
      const invalidQueries = [
        "indexVersion=Pending",
        "indexVersion=pending&indexGenerationId=",
        `indexVersion=pending&indexGenerationId=generation-${"C".repeat(64)}`,
        `indexVersion=pending&indexGenerationId=generation-${"c".repeat(63)}`,
        `indexVersion=pending&indexGenerationId=generation-${"c".repeat(65)}`,
        "indexVersion=pending&indexGenerationId=..%2Fsecret",
        `${selector}&indexVersion=pending`,
        `${selector}&indexVersion=published`,
        `${selector}&indexGenerationId=${generationId}`,
        ...["taskId", "root", "canonicalRoot", "repositoryId", "worktreeId", "sourceSnapshotId", "session", "token", "extra"]
          .map((name) => `${selector}&${name}=${name === "taskId" ? taskId : "override"}`),
      ];
      const invalidRoutes = [
        ...invalidQueries.map((query) => `/meta.json?${query}`),
        ...["/meta.json", "/knowledge-graph.json", "/knowledge-base/wiki-index.json", "/knowledge-base/search-index.json", "/knowledge-base/Overview.md"]
          .map((route) => `${route}?indexVersion=pending`),
        ...["/config.json", `/tasks/${taskId}/brief.json`, `/tasks/${taskId}/change-check.json`, `/tasks/${taskId}/verification.json`,
          `/tasks/${taskId}/knowledge-candidates.json`, "/__workbench/task-brief", "/__workbench/context?surface=graph",
          "/__workbench/trace", "/__workbench/evidence", `/tasks/${taskId}`, `/workbench?view=tasks&taskId=${taskId}`]
          .map((route) => `${route}${route.includes("?") ? "&" : "?"}${selector}`),
      ];
      for (const route of invalidRoutes) {
        const response = await fetch(`${base}${route}`, { headers });
        expect(response.status, route).toBe(409);
        await expect(response.json(), route).resolves.toEqual({ error: "dashboard_route_invalid" });
      }
      expect(calls).toEqual([]);
    } finally {
      await session.close();
    }
  });

  it("rejects pending reads without a session Task while preserving default and published reads", async () => {
    const root = await runtimeRoot("workbench-runtime-pending-no-task-");
    const generationId = `generation-${"c".repeat(64)}`;
    const calls: WorkbenchDashboardReadRequestV1[] = [];
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks" } },
      { ...binding(root), dashboardReader: async (input) => {
        calls.push(input);
        return { status: "ready", json: {} };
      } },
    );
    try {
      const base = `http://127.0.0.1:${session.port}`;
      const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
      const launch = await fetch(`${base}/__workbench/launch`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }),
      });
      const headers = { cookie: launch.headers.get("set-cookie")!.split(";", 1)[0]! };
      for (const route of ["/meta.json", "/knowledge-graph.json", "/knowledge-base/wiki-index.json", "/knowledge-base/search-index.json", "/knowledge-base/Overview.md"]) {
        const response = await fetch(`${base}${route}?indexVersion=pending&indexGenerationId=${generationId}`, { headers });
        expect(response.status, route).toBe(409);
        await expect(response.json(), route).resolves.toEqual({ error: "dashboard_route_invalid" });
      }
      const candidates = await fetch(`${base}/tasks/01ARZ3NDEKTSV4RRFFQ69G5FAV/knowledge-candidates.json`, { headers });
      expect(candidates.status).toBe(409);
      expect(calls).toEqual([]);
      expect((await fetch(`${base}/meta.json`, { headers })).status).toBe(200);
      expect(calls.at(-1)).not.toHaveProperty("indexVersion");
      expect((await fetch(`${base}/meta.json?indexVersion=published`, { headers })).status).toBe(200);
      expect(calls.at(-1)).toMatchObject({ kind: "meta", indexVersion: "published" });
      expect(calls.at(-1)).not.toHaveProperty("indexGenerationId");
    } finally {
      await session.close();
    }
  });

  it("maps Task knowledge candidates only for the session Task with no query overrides", async () => {
    const root = await runtimeRoot("workbench-runtime-pending-candidates-");
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const calls: WorkbenchDashboardReadRequestV1[] = [];
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId, section: "summary" } },
      { ...binding(root), dashboardReader: async (input) => {
        calls.push(input);
        return { status: "ready", json: { kind: input.kind } };
      } },
    );
    try {
      const base = `http://127.0.0.1:${session.port}`;
      const route = `/tasks/${taskId}/knowledge-candidates.json`;
      expect((await fetch(`${base}${route}`)).status).toBe(401);
      const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
      const launch = await fetch(`${base}/__workbench/launch`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }),
      });
      const headers = { cookie: launch.headers.get("set-cookie")!.split(";", 1)[0]! };
      const response = await fetch(`${base}${route}`, { headers });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ kind: "task_knowledge_candidates" });
      expect(calls).toEqual([{
        productVersion: "0.1.0", repositoryId: "repo:test", worktreeId: "worktree:test",
        sourceSnapshotId: "snapshot:test", headCommit: null, freshness: "fresh",
        route: { view: "tasks", taskId, section: "summary" }, kind: "task_knowledge_candidates", taskId,
      }]);
      const invalidRoutes = [
        "/tasks/01ARZ3NDEKTSV4RRFFQ69G5FAW/knowledge-candidates.json",
        "/tasks/invalid/knowledge-candidates.json",
        "/tasks/%E0%A4%A/knowledge-candidates.json",
        ...["taskId", "section", "sourceSnapshotId", "root", "extra"].map((name) => `${route}?${name}=${taskId}`),
        `${route}?indexVersion=published`,
        `${route}?indexGenerationId=generation-${"c".repeat(64)}`,
      ];
      for (const invalidRoute of invalidRoutes) {
        const invalid = await fetch(`${base}${invalidRoute}`, { headers });
        expect(invalid.status, invalidRoute).toBe(409);
        await expect(invalid.json(), invalidRoute).resolves.toEqual({ error: "dashboard_route_invalid" });
      }
      expect((await fetch(`${base}${route}`, {
        headers: { cookie: "workbench_session=invalid" },
      })).status).toBe(401);
      expect(calls).toHaveLength(1);
    } finally {
      await session.close();
    }
  });

  it("reloads same-Task Finding and Evidence URLs without widening the launch capability", async () => {
    const root = await runtimeRoot("workbench-runtime-task-route-");
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const session = await openWorkbenchSessionV1(
      { route: { view: "tasks", taskId } },
      binding(root),
    );
    const base = `http://127.0.0.1:${session.port}`;
    const token = session.output.structuredContent.result.deepLink.split("#")[1]!;
    const launch = await fetch(`${base}/__workbench/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const cookie = launch.headers.get("set-cookie")!.split(";", 1)[0]!;
    const headers = { cookie };

    const finding = await fetch(
      `${base}/workbench?view=tasks&taskId=${taskId}&findingId=finding%3A1`,
      { headers },
    );
    expect(finding.status).toBe(200);
    expect(await finding.text()).toBe(DASHBOARD_INDEX);
    const evidence = await fetch(
      `${base}/workbench?view=tasks&taskId=${taskId}&findingId=finding%3A1&evidenceId=evidence%3A1`,
      { headers },
    );
    expect(evidence.status).toBe(200);
    expect(await evidence.text()).toBe(DASHBOARD_INDEX);

    const deniedRoutes = [
      "/workbench?view=tasks&taskId=01ARZ3NDEKTSV4RRFFQ69G5FAW&findingId=finding%3A1",
      `/workbench?view=graph&taskId=${taskId}`,
      `/workbench?view=tasks&taskId=${taskId}&impactPathId=impact%3A1`,
      `/workbench?view=tasks&taskId=${taskId}&focus=node%3Aother`,
    ];
    for (const route of deniedRoutes) {
      const denied = await fetch(`${base}${route}`, { headers });
      expect(denied.status, route).toBe(409);
      await expect(denied.json()).resolves.toEqual({ error: "route_mismatch" });
    }
    await session.close();
  });

  it("rejects relative roots and expires launch tokens without allowing replay", async () => {
    await expect(
      openWorkbenchSessionV1(
        { route: { view: "tasks" } },
        binding("relative/root"),
      ),
    ).rejects.toMatchObject({ code: "invalid_root" });

    const root = await runtimeRoot("workbench-runtime-expiry-");
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

  it("serves the authenticated React Dashboard and preserves the contract-validated brief endpoint", async () => {
    const root = await runtimeRoot("workbench-runtime-task-");
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
    expect(htmlText).toBe(DASHBOARD_INDEX);
    expect(htmlText).not.toContain("/__workbench/app.js");
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
    const root = await runtimeRoot("workbench-runtime-context-");
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
    const root = await runtimeRoot("workbench-runtime-trace-");
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
          changeCheckClassification: {
            profile: "legacy_summary" as const,
            emptyFindingsAreClean: false as const,
          },
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
    expect(await html.text()).toBe(DASHBOARD_INDEX);
    const trace = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/trace?taskId=${encodeURIComponent(taskId)}`,
      { headers: { cookie } },
    );
    expect(trace.status).toBe(200);
    await expect(trace.json()).resolves.toMatchObject({
      surface: "trace",
      status: "ready",
      changeCheckClassification: {
        profile: "legacy_summary",
        emptyFindingsAreClean: false,
      },
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
    const root = await runtimeRoot("workbench-runtime-evidence-");
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
                nodeIds: ["node:answer"],
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
                nodeIds: [],
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
    expect(htmlText).toBe(DASHBOARD_INDEX);
    const evidenceRoute = await fetch(
      `http://127.0.0.1:${session.port}/workbench?view=tasks&taskId=${taskId}&section=summary&evidenceId=${encodeURIComponent("evidence:ready")}`,
      { headers: { cookie } },
    );
    expect(evidenceRoute.status).toBe(200);
    expect(await evidenceRoute.text()).toBe(DASHBOARD_INDEX);

    const ready = await fetch(
      `http://127.0.0.1:${session.port}/__workbench/evidence?taskId=${taskId}&evidenceId=evidence%3Aready`,
      { headers: { cookie } },
    );
    expect(ready.status).toBe(200);
    await expect(ready.json()).resolves.toMatchObject({
      status: "ready",
      evidence: { nodeIds: ["node:answer"], filePath: "src/example.ts", lineRange: [1, 1] },
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
