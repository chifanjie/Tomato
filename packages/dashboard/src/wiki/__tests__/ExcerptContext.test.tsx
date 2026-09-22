// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { buildExcerptShards } from "@understand-code/core/knowledge-base";
import { ExcerptLoaderProvider, useEvidenceExcerpts } from "../ExcerptContext";
import { KnowledgeFetchContext, createPendingKnowledgeFetcher } from "../../workbench/publishedKnowledge";
import { useDashboardStore } from "../../store";
import { buildWikiRuntimeIndex } from "../wikiIndex";
import { wikiV2Fixture } from "./fixtures/wikiV2Fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.replaceChildren(); useDashboardStore.setState(useDashboardStore.getInitialState(), true); vi.restoreAllMocks(); });
function Consumer() {
  const { excerpts, loading, error, retry } = useEvidenceExcerpts(["evidence:test"]);
  return createElement("section", null, excerpts.get("evidence:test") ?? (loading ? "loading" : error ?? "missing"), createElement("button", { onClick: retry }, "retry"));
}
it("pins evidence to the selected generation, isolates same-id caches and retries transient failures", async () => {
  const { descriptor } = buildExcerptShards([{ id: "evidence:test", excerpt: "seed" }]);
  useDashboardStore.getState().setWikiIndex(buildWikiRuntimeIndex({ ...wikiV2Fixture(), excerptStore: descriptor }));
  const a = `generation-${"a".repeat(64)}`; const b = `generation-${"b".repeat(64)}`;
  let fail = true;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    expect(url.searchParams.get("indexVersion")).toBe("pending");
    if (fail) return new Response(null, { status: 503 });
    return Response.json({ "evidence:test": url.searchParams.get("indexGenerationId") === a ? "source A" : "source B" });
  });
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const show = (generation: string) => createElement(KnowledgeFetchContext.Provider, { value: createPendingKnowledgeFetcher(generation, fetcher) }, createElement(ExcerptLoaderProvider, { accessToken: null, children: createElement(Consumer) }));
  try {
    await act(async () => root.render(show(a)));
    expect(container.textContent).toContain("证据读取失败");
    fail = false;
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("source A");
    await act(async () => root.render(show(b)));
    expect(container.textContent).toContain("source B");
    expect(container.textContent).not.toContain("source A");
    expect(fetcher).toHaveBeenCalledTimes(3);
  } finally { await act(async () => root.unmount()); }
});
