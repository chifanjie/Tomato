import { describe, expect, it, vi } from "vitest";
import { createSearchWorkerEngine } from "../searchWorkerEngine";
import { createSearchWorkerClient, type SearchWorkerLike } from "../searchWorkerClient";
import type { SearchWorkerRequest, SearchWorkerResponse } from "../searchWorkerProtocol";
import { buildWikiRuntimeIndex } from "../wikiIndex";
import { buildWikiSearchRuntime, searchWiki, type WikiSearchResults } from "../searchIndex";
import { parseSearchArtifact } from "../searchArtifactPayload";
import { createSearchArtifactRequestController } from "../wikiArtifacts";
import { searchFixture, wikiV2Fixture } from "./fixtures/wikiV2Fixtures";

const index = buildWikiRuntimeIndex(wikiV2Fixture());
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer;
const metadataOnly = (result: WikiSearchResults) => ({ ...result, groups: result.groups.map((group) => ({ ...group,
  items: group.items.map((record) => { const metadata = { ...record, terms: [], businessTerms: [] }; delete metadata.content; delete metadata.contentLineIds; return metadata; }),
})) });

class FakeWorker implements SearchWorkerLike {
  onmessage: SearchWorkerLike["onmessage"] = null;
  onerror: SearchWorkerLike["onerror"] = null;
  terminate = vi.fn();
  messages: SearchWorkerRequest[] = [];
  engine = createSearchWorkerEngine();
  automatic = true;
  postMessage(message: SearchWorkerRequest, transfer: Transferable[]) {
    const transferred = structuredClone(message, { transfer });
    this.messages.push(transferred);
    if (this.automatic) queueMicrotask(() => this.reply(this.engine(transferred)));
  }
  reply(response: SearchWorkerResponse) { this.onmessage?.({ data: response } as MessageEvent<SearchWorkerResponse>); }
}

describe("dedicated Wiki search worker", () => {
  it("ranks with full bodies and terms but never sends those inputs to the UI", () => {
    const page = searchFixture().find((record) => record.kind === "page")!;
    const record = { ...page, content: `body-only ${"x".repeat(200_000)}`,
      terms: [`index-only-${"y".repeat(200_000)}`], businessTerms: [`business-only-${"z".repeat(200_000)}`] };
    const engine = createSearchWorkerEngine();
    expect(engine({ kind: "initialize", generation: 1, requestId: 1,
      bytes: bytes({ version: 2, records: [record] }), pageIds: [record.pageId] })).toMatchObject({ status: "ready" });
    for (const query of ["body-only", "index-only", "business-only"]) {
      const result = engine({ kind: "query", generation: 1, requestId: 2, query, page: 1, pageSize: 20 });
      expect(result).toMatchObject({ kind: "results", results: { total: 1 } });
      if (result.kind !== "results") throw new Error("expected search results");
      const item = result.results.groups.flatMap((group) => group.items)[0]!;
      expect(item).toMatchObject({ title: record.title, pageId: record.pageId, terms: [], businessTerms: [] });
      expect(item.content).toBeUndefined();
      expect(item.contentLineIds).toBeUndefined();
      expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(4096);
    }
  });

  it("preserves inline/shared ranking, counts and pagination while returning metadata only", () => {
    const source = searchFixture().map((record) => record.kind === "page" ? { ...record, content: "跨行\n词组 Café ＲＵＮ\nunderstand-anything\n频控", summary: "正文" } : record);
    const contentLines: string[] = [];
    const records = source.map((record) => {
      if (record.content === undefined) return record;
      const { content, ...metadata } = record;
      return { ...metadata, contentLineIds: content.split("\n").map((line) => { contentLines.push(line); return contentLines.length - 1; }) };
    });
    for (const payload of [{ version: 2, records: source }, { version: 2, records, contentLines }]) {
      const parsed = parseSearchArtifact(payload);
      if (parsed.status !== "ready") throw new Error("fixture invalid");
      const expected = buildWikiSearchRuntime(parsed.records, index, "full", parsed.contentLines);
      const engine = createSearchWorkerEngine();
      expect(engine({ kind: "initialize", generation: 3, requestId: 1, bytes: bytes(payload), pageIds: [...index.pagesById.keys()] })).toMatchObject({ kind: "initialized", status: "ready" });
      for (const query of ["频控", "run", "跨行\n词组", "Café", "Understand Code", "表单校验", "none"]) for (const page of [1, 2, 3]) {
        const result = engine({ kind: "query", generation: 3, requestId: page + 1, query, page, pageSize: 2 });
        expect(result).toEqual({ kind: "results", generation: 3, requestId: page + 1, results: metadataOnly(searchWiki(expected, query, page, 2)) });
      }
    }
  });

  it("fails closed on invalid payloads, stale generations and unknown page identities", () => {
    const engine = createSearchWorkerEngine();
    expect(engine({ kind: "initialize", generation: 1, requestId: 1, bytes: bytes({ version: 2, records: [{ id: 3 }] }), pageIds: [] })).toMatchObject({ status: "invalid" });
    expect(engine({ kind: "query", generation: 1, requestId: 2, query: "x", page: 1, pageSize: 20 })).toMatchObject({ kind: "error" });
    engine({ kind: "initialize", generation: 2, requestId: 3, bytes: bytes({ version: 2, records: searchFixture() }), pageIds: [] });
    expect(engine({ kind: "query", generation: 1, requestId: 4, query: "表单校验", page: 1, pageSize: 20 })).toMatchObject({ kind: "error" });
    expect(engine({ kind: "query", generation: 2, requestId: 5, query: "表单校验", page: 1, pageSize: 20 })).toMatchObject({ results: { total: 0 } });
  });

  it("transfers input ownership and matches replies by generation and request ID", async () => {
    const worker = new FakeWorker();
    const client = createSearchWorkerClient(() => worker)!;
    const buffer = bytes({ version: 2, records: searchFixture() });
    const initialized = client.initialize(buffer, [...index.pagesById.keys()]);
    expect(buffer.byteLength).toBe(0);
    expect(await initialized).toBe("ready");
    expect(client.runtime.records).toHaveLength(0);
    expect(client.runtime.preparedRecords).toHaveLength(0);
    worker.automatic = false;
    let firstResolved = false;
    const first = client.runtime.searchAsync!("运行", 1, 20).then((value) => { firstResolved = true; return value; });
    const second = client.runtime.searchAsync!("表单校验", 2, 2);
    const firstMessage = worker.messages[1]!;
    const secondMessage = worker.messages[2]!;
    const response = worker.engine(firstMessage);
    worker.reply({ ...response, generation: response.generation + 1 });
    await Promise.resolve();
    expect(firstResolved).toBe(false);
    worker.reply(worker.engine(secondMessage));
    expect(await second).toMatchObject({ page: 2, pageSize: 2 });
    worker.reply(response);
    expect((await first).total).toBeGreaterThan(0);
    const pending = client.runtime.searchAsync!("pending", 1, 20);
    client.dispose();
    await expect(pending).rejects.toThrow();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("keeps pinned fetch transport, reuses a session, and terminates it on reset", async () => {
    const worker = new FakeWorker();
    const factory = vi.fn(() => worker);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ version: 2, records: searchFixture() })));
    const controller = createSearchArtifactRequestController(fetcher, { workerFactory: factory });
    const first = await controller.open("private token", index);
    expect(first.status).toBe("ready");
    if (first.status === "ready") expect(first.records).toHaveLength(0);
    controller.close();
    expect(await controller.open("private token", index)).toBe(first);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]).toEqual([expect.stringContaining("token=private%20token"), expect.objectContaining({ signal: expect.any(AbortSignal) })]);
    controller.reset("new");
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toEqual({ token: "new", result: null });
  });

  it("does not let an old token's late response or worker error replace the current session", async () => {
    let completeOld!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => { completeOld = resolve; });
    const workers: FakeWorker[] = [];
    const controller = createSearchArtifactRequestController(vi.fn(async (input) => String(input).includes("token=old") ? oldResponse : new Response(JSON.stringify({ version: 2, records: searchFixture() }))),
      { workerFactory: () => { const worker = new FakeWorker(); workers.push(worker); return worker; } });
    const old = controller.open("old", index);
    const current = await controller.open("new", index);
    completeOld(new Response("broken"));
    await old;
    workers[0]?.onerror?.({} as ErrorEvent);
    expect(controller.snapshot()).toEqual({ token: "new", result: current });
    expect(workers[0]?.terminate).toHaveBeenCalledOnce();
    controller.reset();
  });

  it("degrades a large index when workers are unavailable without parsing it on the main thread", async () => {
    const response = new Response("not JSON", { headers: { "content-length": String(97 * 1024 * 1024) } });
    const read = vi.spyOn(response, "arrayBuffer");
    const controller = createSearchArtifactRequestController(vi.fn(async () => response), { workerFactory: () => null });
    expect((await controller.open("token", index)).status).toBe("error");
    expect(read).not.toHaveBeenCalled();
    controller.reset();
  });
});
