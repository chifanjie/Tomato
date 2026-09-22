import type { ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

function acceptsGzip(header: string | undefined): boolean {
  const encodings = (header ?? "").toLowerCase().split(",").map((entry) => {
    const [name, ...parameters] = entry.trim().split(";");
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const q = quality === undefined ? 1 : Number(quality.trim().slice(2));
    return { name, q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
  });
  return ((encodings.find((entry) => entry.name === "gzip") ?? encodings.find((entry) => entry.name === "*"))?.q ?? 0) > 0;
}

/** Compress large authenticated responses without blocking the event loop. */
export async function writeDashboardBody(response: ServerResponse, body: string, headers: Record<string, string>, acceptEncoding?: string): Promise<void> {
  if (Buffer.byteLength(body) < 4096 || !acceptsGzip(acceptEncoding)) {
    response.writeHead(200, { ...headers, vary: "Accept-Encoding" });
    response.end(body);
    return;
  }
  response.writeHead(200, { ...headers, vary: "Accept-Encoding", "content-encoding": "gzip" });
  try {
    await pipeline(Readable.from([body]), createGzip({ level: 3 }), response);
  } catch {
    // A browser navigation can close the socket while a large response streams.
    // Do not retry or expose a partial JSON response as a successful resource.
    response.destroy();
  }
}
