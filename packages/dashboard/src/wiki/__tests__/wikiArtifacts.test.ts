import { describe, expect, it, vi } from "vitest";
import { loadDashboardKnowledge } from "../../workbench/knowledgeContextLoader";
import {
  createSearchArtifactRequestController,
  loadSearchArtifact,
} from "../wikiArtifacts";
import { searchFixture, wikiV2Fixture } from "./fixtures/wikiV2Fixtures";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("lazy Wiki search artifact", () => {
  it("does not fetch search until its loader is called and uses the access token", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("wiki-index.json")) return jsonResponse(wikiV2Fixture());
      if (url.includes("search-index.json")) {
        return jsonResponse({ version: 2, generatedAt: "2026-07-12T00:00:00Z", records: searchFixture() });
      }
      return new Response("not found", { status: 404 });
    });

    await loadDashboardKnowledge("token with space", fetchSpy as unknown as typeof fetch);
    expect(fetchSpy.mock.calls.map(([input]) => String(input))
      .filter((url) => url.includes("search-index.json"))).toHaveLength(0);

    const loaded = await loadSearchArtifact("token with space", fetchSpy as unknown as typeof fetch);
    const searchCalls = fetchSpy.mock.calls.map(([input]) => String(input))
      .filter((url) => url.includes("search-index.json"));
    expect(loaded).toMatchObject({
      status: "ready",
      records: expect.arrayContaining([expect.objectContaining({ id: "search:run" })]),
    });
    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0]).toContain("/knowledge-base/search-index.json");
    expect(searchCalls[0]).toContain("token=token%20with%20space");
  });

  it.each([
    ["forbidden", () => new Response("forbidden", { status: 403 })],
    ["missing", () => new Response("missing", { status: 404 })],
    ["error", () => new Response("bad gateway", { status: 502 })],
    ["invalid", () => new Response("{broken", { status: 200 })],
    ["invalid", () => jsonResponse({ version: 1, records: searchFixture() })],
    ["invalid", () => jsonResponse({ version: 2, records: [{ id: 3 }] })],
  ] as const)("maps a transport response to %s", async (status, response) => {
    const loaded = await loadSearchArtifact("token", vi.fn(async () => response()) as unknown as typeof fetch);
    expect(loaded).toEqual({ status, records: [] });
  });

  it("maps a network exception to error", async () => {
    const loaded = await loadSearchArtifact("token", vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch);
    expect(loaded).toEqual({ status: "error", records: [] });
  });

  it("rejects unknown categories and symbols without nonempty anchor and nodeId", async () => {
    const valid = searchFixture();
    const invalidPayloads = [
      { version: 2, records: [{ ...valid[0], category: "mystery" }] },
      { version: 2, records: [{ ...valid[3], anchor: "" }] },
      { version: 2, records: [{ ...valid[3], nodeId: "   " }] },
    ];
    for (const payload of invalidPayloads) {
      const loaded = await loadSearchArtifact(
        "token",
        vi.fn(async () => jsonResponse(payload)) as unknown as typeof fetch,
      );
      expect(loaded).toEqual({ status: "invalid", records: [] });
    }
  });

  it("accepts generatedAt and optional page content in the generated envelope", async () => {
    const records = searchFixture();
    const loaded = await loadSearchArtifact(
      "token",
      vi.fn(async () => jsonResponse({
        version: 2,
        generatedAt: "2026-07-12T00:00:00.000Z",
        records,
      })) as unknown as typeof fetch,
    );
    expect(loaded).toEqual({ status: "ready", records });
  });

  it("reuses an in-flight request when search closes and reopens for the same token", async () => {
    const response = deferred<Response>();
    const fetchSpy = vi.fn(() => response.promise);
    const controller = createSearchArtifactRequestController(fetchSpy as unknown as typeof fetch);

    const first = controller.open("token");
    controller.close();
    const reopened = controller.open("token");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    response.resolve(jsonResponse({ version: 2, records: searchFixture() }));
    await expect(first).resolves.toMatchObject({ status: "ready" });
    await expect(reopened).resolves.toMatchObject({ status: "ready" });
    expect(controller.snapshot()).toMatchObject({ token: "token", result: { status: "ready" } });
  });

  it("never lets an older token response replace the current token result", async () => {
    const oldResponse = deferred<Response>();
    const newResponse = deferred<Response>();
    const fetchSpy = vi.fn((input: RequestInfo | URL) =>
      String(input).includes("token=old") ? oldResponse.promise : newResponse.promise);
    const controller = createSearchArtifactRequestController(fetchSpy as unknown as typeof fetch);

    const oldRequest = controller.open("old");
    const newRequest = controller.open("new");
    newResponse.resolve(jsonResponse({ version: 2, records: searchFixture() }));
    await newRequest;
    oldResponse.resolve(new Response("missing", { status: 404 }));
    await oldRequest;

    expect(controller.snapshot()).toMatchObject({
      token: "new",
      result: { status: "ready" },
    });
    expect(controller.isCurrent("old")).toBe(false);
    expect(controller.isCurrent("new")).toBe(true);
  });

  it("invalidates an old in-flight response when the token changes while search stays closed", async () => {
    const oldResponse = deferred<Response>();
    const controller = createSearchArtifactRequestController(
      vi.fn(() => oldResponse.promise) as unknown as typeof fetch,
    );

    const oldRequest = controller.open("old");
    controller.close();
    controller.reset("new");
    oldResponse.resolve(jsonResponse({ version: 2, records: searchFixture() }));
    await oldRequest;

    expect(controller.snapshot()).toEqual({ token: "new", result: null });
    expect(controller.isCurrent("old")).toBe(false);
  });
});
