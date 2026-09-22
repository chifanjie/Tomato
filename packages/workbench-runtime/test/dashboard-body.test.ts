import { createServer, get } from "node:http";
import { once } from "node:events";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { writeDashboardBody } from "../src/dashboard-body.js";

async function request(body: string, acceptEncoding: string) {
  const server = createServer((req, res) => { void writeDashboardBody(res, body, { "content-type": "application/json", "cache-control": "no-store" }, req.headers["accept-encoding"]); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as { port: number }).port;
    return await new Promise<{ bytes: Buffer; encoding?: string; cache?: string }>((resolve, reject) => {
      get(`http://127.0.0.1:${port}`, { headers: { "accept-encoding": acceptEncoding } }, (res) => {
        const bytes: Buffer[] = [];
        res.on("data", (chunk: Buffer) => bytes.push(chunk));
        res.once("error", reject);
        res.once("end", () => resolve({ bytes: Buffer.concat(bytes), encoding: res.headers["content-encoding"], cache: res.headers["cache-control"] }));
      }).once("error", reject);
    });
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

describe("large dashboard responses", () => {
  it("streams smaller gzip bytes while preserving the full JSON and no-store boundary", async () => {
    const body = JSON.stringify({ records: Array.from({ length: 3000 }, (_, i) => ({ id: i, title: "源码证据和知识库搜索", path: `src/module-${i}.ts` })) });
    const response = await request(body, "gzip, deflate");
    expect(response.encoding).toBe("gzip");
    expect(response.cache).toBe("no-store");
    expect(gunzipSync(response.bytes).toString()).toBe(body);
    expect(response.bytes.length).toBeLessThan(Buffer.byteLength(body) / 4);
  });
  it("respects explicit gzip refusal, including wildcard fallback", async () => {
    const body = JSON.stringify({ content: "x".repeat(5000) });
    const response = await request(body, "gzip;q=0, *;q=1");
    expect(response.encoding).toBeUndefined();
    expect(response.bytes.toString()).toBe(body);
  });
});
