import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import type { SearchWorkerRequest, SearchWorkerResponse } from "../searchWorkerProtocol";
import { searchFixture } from "./fixtures/wikiV2Fixtures";

const dashboardRoot = fileURLToPath(new URL("../../..", import.meta.url));

describe("production search worker", () => {
  for (const config of ["vite.config.ts", "vite.config.demo.ts", "vite.config.preview.mjs"]) {
    it(`runs ${config} without a DOM and preserves Markdown entity/code context`, async () => {
      const directory = await mkdtemp(path.join(tmpdir(), "understand-search-worker-"));
      let worker: Worker | undefined;
      try {
        const output = path.join(directory, "dist");
        await build({ root: dashboardRoot, configFile: path.join(dashboardRoot, config), logLevel: "silent",
          build: { outDir: output, emptyOutDir: true, rollupOptions: { input: path.join(dashboardRoot, "src/wiki/searchWorkerClient.ts") } },
        });
        const asset = (await readdir(path.join(output, "assets"))).find((name) => /^search\.worker-.*\.js$/.test(name));
        expect(asset).toBeTruthy();
        // Adapt only the Web Worker messaging API. There is deliberately no
        // document/window shim: browser-only parser imports must fail this test.
        const bridge = path.join(directory, "bridge.mjs");
        await writeFile(bridge, `import { parentPort } from "node:worker_threads";
globalThis.self = globalThis;
globalThis.postMessage = (message) => parentPort.postMessage(message);
await import(${JSON.stringify(pathToFileURL(path.join(output, "assets", asset!)).href)});
parentPort.on("message", (data) => globalThis.onmessage({ data }));
parentPort.postMessage({ kind: "booted" });
`);
        worker = new Worker(pathToFileURL(bridge), { execArgv: [] });
        await new Promise<void>((resolve, reject) => {
          worker!.once("error", reject);
          worker!.once("message", () => { worker!.off("error", reject); resolve(); });
        });
        const exchange = (message: SearchWorkerRequest) => new Promise<SearchWorkerResponse>((resolve, reject) => {
          const receive = (value: SearchWorkerResponse) => { worker!.off("error", fail); resolve(value); };
          const fail = (error: Error) => { worker!.off("message", receive); reject(error); };
          worker!.once("error", fail);
          worker!.once("message", receive);
          worker!.postMessage(message, message.kind === "initialize" ? [message.bytes] : []);
        });
        const page = searchFixture().find((record) => record.kind === "page")!;
        const record = { ...page, title: "worker fixture", summary: "worker fixture", terms: [], businessTerms: [],
          content: "understand&#45;anything &amp; prose\n\n```txt\nunderstand-anything\n```" };
        const bytes = new TextEncoder().encode(JSON.stringify({ version: 2, records: [record] })).buffer;
        expect(await exchange({ kind: "initialize", generation: 7, requestId: 1, bytes, pageIds: [record.pageId] })).toMatchObject({ status: "ready" });
        expect(bytes.byteLength).toBe(0);
        for (const [requestId, query] of [[2, "Understand Code"], [3, "understand-anything"]] as const) {
          const result = await exchange({ kind: "query", generation: 7, requestId, query, page: 1, pageSize: 20 });
          expect(result).toMatchObject({ generation: 7, requestId, kind: "results", results: { total: 1, mode: "full" } });
          if (result.kind === "results") expect(result.results.groups.flatMap((group) => group.items)
            .every((item) => item.content === undefined && item.contentLineIds === undefined && item.terms.length === 0 && item.businessTerms.length === 0)).toBe(true);
        }
      } finally {
        await worker?.terminate();
        await rm(directory, { recursive: true, force: true });
      }
    }, 30_000);
  }
});
