// @vitest-environment happy-dom

import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { useDashboardStore } from "../store";
import { wikiV2Fixture } from "../wiki/__tests__/fixtures/wikiV2Fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const projection = {
  task: {
    schemaVersion: 1,
    taskId,
    title: "Preserve evidence across Agent handoffs",
    originalIntent: "Keep task evidence stable when Codex and Claude continue the same change.",
    status: "verified",
    repositoryId: "repository:fixture",
    worktreeId: "worktree:fixture",
    baselineSnapshotId: "snapshot:baseline",
    latestSnapshotId: "snapshot:actual",
    currentChangeCheckId: "change-check:final",
    currentChangeCheckRevision: 9,
    createdAt: "2026-07-28T08:00:00Z",
    updatedAt: "2026-07-28T08:12:00Z",
    producerVersion: "3.0.0-alpha.1",
    revision: 12,
  },
  brief: {
    originalIntent: "Keep task evidence stable when Codex and Claude continue the same change.",
    goalClaimId: "claim:goal",
    nonGoalClaimIds: [],
    acceptanceClaimIds: ["claim:acceptance"],
    readingPath: [],
    plannedChanges: [],
    assumptionClaimIds: [],
    riskClaimIds: [],
    unknownClaimIds: [],
    verificationPlan: [],
  },
  section: "summary",
  items: [{
    kind: "summary",
    originalIntent: "Keep task evidence stable when Codex and Claude continue the same change.",
    goalClaimId: "claim:goal",
    acceptanceClaimCount: 1,
    plannedChangeCount: 0,
  }],
  pulse: null,
  freshness: { sourceSnapshotId: "snapshot:actual", current: true },
};

function response(status: number, body: unknown) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": typeof body === "string" ? "text/markdown" : "application/json" },
  });
}

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
  try { window.localStorage?.clear(); } catch { /* storage is optional in happy-dom */ }
  try { window.sessionStorage?.clear(); } catch { /* storage is optional in happy-dom */ }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  useDashboardStore.setState(useDashboardStore.getInitialState(), true);
});

describe("Task-first Preview host bridge", () => {
  it("opens one pinned published knowledge version without changing the Task route", async () => {
    const deepLink = `/workbench?view=tasks&taskId=${taskId}&section=summary&surface=wiki&focus=page%3Arun`;
    window.history.replaceState(null, "", deepLink);
    const generationId = `generation-${"a".repeat(64)}`;
    let heldMeta = false;
    let holdCurrentWiki = false;
    let resolveMeta!: (value: Response) => void;
    const publishedMeta = { knowledgeVersion: {
      status: "historical", generationId, sourceSnapshotId: "snapshot:published",
      currentSnapshotId: "snapshot:actual", finalizedProviderRevision: 2,
    } };
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith("/brief.json")) return response(200, projection);
      if (url.pathname === "/meta.json" && url.searchParams.get("indexVersion") === "published") {
        if (heldMeta) return new Promise<Response>((resolve) => { resolveMeta = resolve; });
        return response(200, publishedMeta);
      }
      if (holdCurrentWiki && url.pathname.endsWith("/wiki-index.json") && !url.searchParams.has("indexVersion")) return new Promise<Response>(() => {});
      if (url.searchParams.get("indexGenerationId") !== generationId) return response(503, {});
      expect(url.searchParams.get("indexVersion")).toBe("published");
      if (url.pathname.endsWith("/wiki-index.json")) return response(200, wikiV2Fixture());
      if (url.pathname.endsWith(".md")) return response(200, "# 运行流程\n\n来自已发布版本的正文。");
      if (url.pathname === "/knowledge-graph.json") return response(200, {
        version: "1.0.0", project: { name: "Published knowledge", languages: ["typescript"], frameworks: [], description: "", analyzedAt: "2026-07-28T08:00:00Z", gitCommitHash: "local" },
        nodes: [{ id: "function:src/a.ts:run", type: "function", name: "run", filePath: "src/a.ts", summary: "Run", tags: [], complexity: "simple" }],
        edges: [], layers: [], tour: [],
      });
      return response(404, {});
    });
    vi.stubGlobal("fetch", fetcher);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(App)));
      const openPublished = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "查看已发布版本");
      expect(openPublished).toBeDefined();
      await act(async () => openPublished!.click());
      expect(container.textContent).toContain("历史知识 · 只读");
      expect(container.textContent).toContain("来自已发布版本的正文");
      expect(container.textContent).toContain("不能作为当前任务证据");
      expect(window.location.pathname + window.location.search).toBe(deepLink);
      expect(fetcher.mock.calls.filter(([input]) => String(input).includes("/brief.json"))).toHaveLength(1);
      const search = container.querySelector<HTMLButtonElement>('button[aria-label="搜索知识库"]');
      await act(async () => search!.click());
      expect(fetcher.mock.calls.some(([input]) => String(input) === `/knowledge-base/search-index.json?indexVersion=published&indexGenerationId=${generationId}`)).toBe(true);
      await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="关闭搜索"]')!.click());
      heldMeta = true;
      const refresh = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "重新读取已发布版本");
      await act(async () => { refresh!.click(); refresh!.click(); });
      expect(container.textContent).toContain("正在读取版本");
      expect(fetcher.mock.calls.filter(([input]) => String(input) === "/meta.json?indexVersion=published")).toHaveLength(2);
      const current = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "返回当前版本");
      expect(current).toBeDefined();
      holdCurrentWiki = true;
      await act(async () => current!.click());
      expect(useDashboardStore.getState().wikiIndex.pagesById.size).toBe(0);
      expect(useDashboardStore.getState().graph).toBeNull();
      await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="搜索知识库"]')!.click());
      const query = container.querySelector<HTMLInputElement>("#global-wiki-search-input")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(query, "运行流程");
        query.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(container.querySelector('[role="dialog"]')?.textContent).toContain("没有找到匹配内容");
      expect(container.querySelector('[role="dialog"]')?.textContent).not.toContain("运行流程");
      await act(async () => resolveMeta(response(200, publishedMeta)));
      expect(container.textContent).not.toContain("历史知识 · 只读");
      expect(container.textContent).not.toContain("来自已发布版本的正文");
      expect(window.location.pathname + window.location.search).toBe(deepLink);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it.each([
    { status: 503, body: {}, expired: false },
    { status: 200, body: { knowledgeVersion: { status: "historical" } }, expired: false },
    { status: 401, body: {}, expired: true },
    { status: 403, body: {}, expired: true },
  ])("keeps failed published reads explicit ($status, expired: $expired)", async ({ status, body, expired }) => {
    const deepLink = `/workbench?view=tasks&taskId=${taskId}&section=summary&surface=wiki`;
    window.history.replaceState(null, "", deepLink);
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith("/brief.json")) return response(200, projection);
      if (url.pathname === "/meta.json" && url.searchParams.get("indexVersion") === "published") return response(status, body);
      return response(503, {});
    });
    vi.stubGlobal("fetch", fetcher);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(App)));
      const openPublished = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "查看已发布版本");
      await act(async () => openPublished!.click());
      expect(container.textContent).not.toContain("历史知识 · 只读");
      expect(container.textContent).not.toContain("关系图谱仍可使用");
      expect(container.textContent).toContain(expired ? "工作台会话已过期" : "已发布版本暂不可用，请重试。当前任务未改变。");
      expect(window.location.pathname + window.location.search).toBe(deepLink);
      expect(fetcher.mock.calls.filter(([input]) => String(input).includes("/brief.json"))).toHaveLength(1);
      if (!expired) {
        expect(openPublished!.disabled).toBe(false);
        await act(async () => openPublished!.click());
        expect(fetcher.mock.calls.filter(([input]) => String(input) === "/meta.json?indexVersion=published")).toHaveLength(2);
      }
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("keeps an explicit historical Wiki node jump when the Task surface synchronizes", async () => {
    window.history.replaceState(null, "", `/workbench?view=tasks&taskId=${taskId}&section=summary&surface=wiki&focus=page%3Arun`);
    const generationId = `generation-${"b".repeat(64)}`;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith("/brief.json")) return response(200, projection);
      if (url.searchParams.get("indexVersion") !== "published") return response(503, {});
      if (url.pathname === "/meta.json") return response(200, { knowledgeVersion: {
        status: "historical", generationId, sourceSnapshotId: "snapshot:published",
        currentSnapshotId: "snapshot:actual", finalizedProviderRevision: 2,
      } });
      if (url.pathname.endsWith("/wiki-index.json")) return response(200, wikiV2Fixture());
      if (url.pathname.endsWith(".md")) return response(200, "# 运行流程\n\n历史节点跳转测试。");
      if (url.pathname === "/knowledge-graph.json") return response(200, {
        version: "1.0.0", project: { name: "Published knowledge", languages: ["typescript"], frameworks: [], description: "", analyzedAt: "2026-07-28T08:00:00Z", gitCommitHash: "local" },
        nodes: [{ id: "function:src/a.ts:run", type: "function", name: "run", filePath: "src/a.ts", summary: "Run", tags: [], complexity: "simple" }],
        edges: [], layers: [], tour: [],
      });
      return response(404, {});
    }));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(App)));
      await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "查看已发布版本")!.click());
      await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "在图谱中查看本文节点")!.click());
      expect(useDashboardStore.getState().graphFocusPageId).toBe("page:run");
      expect(useDashboardStore.getState().graphFocusNodeIds).toEqual(["function:src/a.ts:run"]);
      expect(new URLSearchParams(window.location.search).get("focus")).toBe("function:src/a.ts:run");
      expect(container.textContent).toContain("历史知识 · 只读");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("opens the unified shell on the knowledge surfaces by default", async () => {
    // "/" is how `/understand-dashboard` opens the workbench: the user came to
    // read the graph and wiki they just generated, not an empty Task home.
    window.history.replaceState(null, "", "/?token=preview-token");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(App)));
    await act(async () => Promise.resolve());

    // The knowledge shell is behind React.lazy, so assert the routing decision
    // rather than racing its chunk: the empty Task workbench must not mount.
    expect(container.querySelector('[data-testid="task-first-workbench"]')).toBeNull();
    expect(container.textContent).not.toContain("尚未选择任务");
    await act(async () => root.unmount());
  });

  it("downloads the wiki index once even though StrictMode runs effects twice", async () => {
    // `/understand-dashboard` always serves the workbench from the Vite dev
    // server, so every reader pays StrictMode's double effect — on an index
    // that is megabytes on a real repository.
    window.history.replaceState(null, "", "/?token=preview-token");
    let wikiReads = 0;
    let graphReads = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const pathname = new URL(String(input), window.location.origin).pathname;
      if (pathname.endsWith("/wiki-index.json")) {
        wikiReads += 1;
        await Promise.resolve();
        return response(200, wikiV2Fixture());
      }
      if (pathname.endsWith("knowledge-graph.json")) graphReads += 1;
      return response(404, {});
    });
    vi.stubGlobal("fetch", fetcher);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(
      createElement(StrictMode, null, createElement(App)),
    ));
    await act(async () => Promise.resolve());

    expect(wikiReads).toBe(1);
    // The graph load has no coalescing, so its count is the control that
    // proves StrictMode really did invoke the effects twice.
    expect(graphReads).toBe(2);
    await act(async () => root.unmount());
  });

  it("still opens the Task home for an explicit #tasks entry point", async () => {
    window.history.replaceState(null, "", "/?token=preview-token#tasks");
    vi.stubGlobal("fetch", vi.fn(async () => response(404, {})));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(App)));
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-testid="task-home"]')).not.toBeNull();
    const current = container.querySelector<HTMLButtonElement>(
      'nav[aria-label="主要界面"] button[aria-current="page"]',
    );
    expect(current?.textContent).toBe("任务");
    await act(async () => root.unmount());
  });

  it.each([
    ["知识库", "wiki"],
    ["关系图谱", "graph"],
  ] as const)("opens %s from the empty Task home without inventing Task context", async (label, hash) => {
    // The empty Task home is now reached explicitly rather than as the default.
    window.history.replaceState(null, "", "/?token=preview-token#tasks");
    vi.stubGlobal("fetch", vi.fn(async () => response(404, {})));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(App)));
    const surfaceButton = Array.from(container.querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="主要界面"] button',
    )).find((button) => button.textContent === label);
    expect(surfaceButton).toBeDefined();

    await act(async () => surfaceButton?.click());
    await act(async () => Promise.resolve());

    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe(`#${hash}`);
    expect(container.querySelector('[data-testid="task-context-overlay"]')).toBeNull();
    expect(container.textContent).not.toContain("目标不可用");
    const current = container.querySelector<HTMLButtonElement>(
      'nav[aria-label="主要界面"] button[aria-current="page"]',
    );
    expect(current?.textContent).toBe(label);
    await act(async () => root.unmount());
  });

  it("renders the real persisted Task projection on a Task deep link", async () => {
    window.history.replaceState(null, "", `/tasks/${taskId}?token=preview-token`);
    vi.stubGlobal("fetch", vi.fn(async () => response(200, projection)));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(App)));
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-testid="task-first-workbench"]')).not.toBeNull();
    expect(container.textContent).toContain("Preserve evidence across Agent handoffs");
    expect(container.textContent).toContain("只读");

    const wikiButton = Array.from(container.querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="主要界面"] button',
    )).find((button) => button.textContent === "知识库");
    await act(async () => wikiButton?.click());
    await act(async () => Promise.resolve());

    expect(window.location.pathname).toBe(`/tasks/${taskId}`);
    expect(new URLSearchParams(window.location.search).get("surface")).toBe("wiki");
    expect(container.querySelector('[data-testid="task-context-overlay"]')).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("refreshes the task revision without dropping the selected section or visible content", async () => {
    vi.useFakeTimers();
    const deepLink = `/workbench?view=tasks&taskId=${taskId}&section=goals`;
    window.history.replaceState(null, "", deepLink);
    let reads = 0;
    let release!: (value: Response) => void;
    const next = { ...projection, section: "goals", items: [], task: { ...projection.task, revision: 13 } };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/brief.json")) {
        reads += 1;
        if (reads === 1) return response(200, { ...next, task: projection.task });
        return new Promise<Response>((resolve) => { release = resolve; });
      }
      return response(404, {});
    }));
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(App)));
      expect(container.textContent).toContain("修订版 12");
      await act(async () => vi.advanceTimersByTimeAsync(10_000));
      expect(reads).toBe(2);
      expect(container.querySelector('[data-testid="task-first-workbench"]')?.getAttribute("data-state")).toBe("ready");
      expect(container.textContent).toContain(projection.task.title);
      await act(async () => vi.advanceTimersByTimeAsync(10_000));
      expect(reads).toBe(2);
      await act(async () => release(response(200, next)));
      expect(container.textContent).toContain("修订版 13");
      expect(window.location.pathname + window.location.search).toBe(deepLink);
      expect(container.querySelector('button[aria-current="page"][aria-pressed="true"]')?.textContent).toContain("目标");
    } finally { await act(async () => root.unmount()); }
  });

  it("keeps an unavailable persisted Task in the explicit failure state", async () => {
    window.history.replaceState(null, "", `/tasks/${taskId}?token=preview-token`);
    vi.stubGlobal("fetch", vi.fn(async () => response(404, { error: "task_brief_not_available" })));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(App)));
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-testid="task-first-workbench"]')).not.toBeNull();
    expect(container.textContent).toContain("任务简报加载失败");
    await act(async () => root.unmount());
  });

  it.each([false, true])("retries only Wiki and preserves the Task deep link (automatic retries exhausted: %s)", async (exhausted) => {
    vi.useFakeTimers();
    const deepLink = `/workbench?view=tasks&taskId=${taskId}&section=summary&surface=wiki&focus=page%3Arun&findingId=finding%3Arun`;
    window.history.replaceState(null, "", deepLink);
    let wikiReads = 0;
    let retryPending = false;
    let resolveRetry!: (result: Response) => void;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const pathname = new URL(String(input), window.location.origin).pathname;
      if (pathname.endsWith("/wiki-index.json")) {
        wikiReads += 1;
        if (retryPending) return new Promise<Response>((resolve) => { resolveRetry = resolve; });
        return response(503, { error: "unavailable" });
      }
      if (pathname.endsWith("/brief.json")) return response(200, projection);
      if (pathname === "/knowledge-graph.json") return response(200, {
        version: "1.0.0",
        project: { name: "Wiki recovery fixture", languages: ["typescript"], frameworks: [], description: "", analyzedAt: "2026-07-28T08:00:00Z", gitCommitHash: "local" },
        nodes: [{ id: "function:src/a.ts:run", type: "function", name: "run", filePath: "src/a.ts", summary: "Run the fixture", tags: [], complexity: "simple" }],
        edges: [], layers: [], tour: [],
      });
      if (pathname.endsWith(".md")) return response(200, "# 运行流程\n\nWiki 恢复后的正文。");
      return response(404, {});
    });
    vi.stubGlobal("fetch", fetcher);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(App)));
      if (exhausted) await act(async () => vi.advanceTimersByTimeAsync(3_000));
      expect(wikiReads).toBe(exhausted ? 4 : 1);
      expect(container.textContent).toContain("知识库读取失败");
      const retry = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "重新读取知识库");
      expect(retry).toBeDefined();
      const graphReads = () => fetcher.mock.calls.filter(([input]) => String(input).includes("knowledge-graph.json")).length;
      const taskReads = () => fetcher.mock.calls.filter(([input]) => String(input).includes("/brief.json")).length;
      const originalGraphReads = graphReads();
      const originalTaskReads = taskReads();
      retryPending = true;
      await act(async () => { retry!.click(); retry!.click(); });
      expect(wikiReads).toBe(exhausted ? 5 : 2);
      expect(container.textContent).toContain("正在读取知识库");
      await act(async () => vi.advanceTimersByTimeAsync(5_000));
      expect(wikiReads).toBe(exhausted ? 5 : 2);
      await act(async () => resolveRetry(response(200, wikiV2Fixture())));
      expect(container.textContent).toContain("Wiki 恢复后的正文");
      expect(container.textContent).not.toContain("知识库读取失败");
      expect(window.location.pathname + window.location.search).toBe(deepLink);
      expect(container.querySelector('[data-testid="task-context-overlay"]')).not.toBeNull();
      expect(useDashboardStore.getState().activeWikiPageId).toBe("page:run");
      expect(graphReads()).toBe(originalGraphReads);
      expect(taskReads()).toBe(originalTaskReads);
      await act(async () => vi.advanceTimersByTimeAsync(5_000));
      expect(wikiReads).toBe(exhausted ? 5 : 2);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

it.each(["click", "keyboard"])("opens search from the task page on the first %s action", async (action) => {
  window.history.replaceState(null, "", `/workbench?view=tasks&taskId=${taskId}`);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname.endsWith("/brief.json")) return response(200, projection);
    if (url.pathname.endsWith("/wiki-index.json")) return response(200, wikiV2Fixture());
    if (url.pathname.endsWith("/search-index.json")) return response(200, { version: 2, records: [] });
    return response(404, {});
  }));
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(App)));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => {
      if (action === "click") container.querySelector<HTMLButtonElement>('[aria-label="搜索知识库"]')!.click();
      else window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[role="dialog"][aria-label="全局搜索知识库"]')).not.toBeNull();
    expect(window.location.search).not.toContain("wikiSearch");
  } finally { await act(async () => root.unmount()); }
});

it("keeps a Task Wiki chapter in the URL and restores its anchor after reopening", async () => {
  window.history.replaceState(null, "", `/workbench?view=tasks&taskId=${taskId}&surface=wiki&focus=page%3Arun`);
  const scrolled: HTMLElement[] = [];
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(function (this: HTMLElement) { scrolled.push(this); });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname.endsWith("/brief.json")) return response(200, projection);
    if (url.pathname.endsWith("/wiki-index.json")) return response(200, wikiV2Fixture());
    if (url.pathname.endsWith(".md")) return response(200, "# 运行流程\n\n[查看章节](#run)\n\n## run\n\n函数解释。");
    return response(404, {});
  }));
  const container = document.createElement("div"); document.body.append(container); let root = createRoot(container);
  try {
    await act(async () => root.render(createElement(App)));
    await act(async () => [...container.querySelectorAll<HTMLAnchorElement>("a")].find((link) => link.textContent === "查看章节")!.click());
    expect(new URLSearchParams(window.location.search).get("wikiAnchor")).toBe("run");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(scrolled.some((element) => element.dataset.wikiAnchor === "run")).toBe(true);
    await act(async () => root.unmount());
    scrolled.length = 0;
    useDashboardStore.setState(useDashboardStore.getInitialState(), true);
    root = createRoot(container);
    await act(async () => root.render(createElement(App)));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(scrolled.some((element) => element.dataset.wikiAnchor === "run")).toBe(true);
  } finally { await act(async () => root.unmount()); }
});
