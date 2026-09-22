import { buildWikiSearchRuntimeForPages, type WikiSearchRuntime } from "./searchIndex";
import type { SearchWorkerRequest, SearchWorkerResponse } from "./searchWorkerProtocol";

export interface SearchWorkerLike {
  onmessage: ((event: MessageEvent<SearchWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: SearchWorkerRequest, transfer: Transferable[]): void;
  terminate(): void;
}
export type SearchWorkerFactory = () => SearchWorkerLike | null;
export interface SearchWorkerClient {
  runtime: WikiSearchRuntime;
  initialize(bytes: ArrayBuffer, pageIds: string[]): Promise<"ready" | "invalid">;
  dispose(): void;
}

let nextGeneration = 0;
function browserWorker(): SearchWorkerLike | null {
  return typeof Worker === "undefined" ? null : new Worker(new URL("./search.worker.ts", import.meta.url), { type: "module" });
}

export function createSearchWorkerClient(factory: SearchWorkerFactory = browserWorker): SearchWorkerClient | null {
  let worker: SearchWorkerLike | null;
  try { worker = factory(); } catch { return null; }
  if (!worker) return null;
  const generation = ++nextGeneration;
  let nextRequest = 0;
  let disposed = false;
  const pending = new Map<number, { resolve: (value: SearchWorkerResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    worker.onmessage = null;
    worker.onerror = null;
    try { worker.terminate(); } catch { /* Reject pending work even if platform cleanup fails. */ }
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("全文搜索不可用，请重试。"));
    }
    pending.clear();
  };
  worker.onerror = dispose;
  worker.onmessage = ({ data }) => {
    if (data.generation !== generation) return;
    const request = pending.get(data.requestId);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(data.requestId);
    if (data.kind === "error") request.reject(new Error("全文搜索不可用，请重试。"));
    else request.resolve(data);
  };
  const request = (message: Omit<Extract<SearchWorkerRequest, { kind: "initialize" }>, "generation" | "requestId"> | Omit<Extract<SearchWorkerRequest, { kind: "query" }>, "generation" | "requestId">, transfer: Transferable[] = []) => {
    if (disposed) return Promise.reject(new Error("全文搜索已关闭。"));
    const requestId = ++nextRequest;
    return new Promise<SearchWorkerResponse>((resolve, reject) => {
      pending.set(requestId, { resolve, reject, timer: setTimeout(dispose, message.kind === "initialize" ? 30_000 : 10_000) });
      try { worker.postMessage({ ...message, generation, requestId }, transfer); } catch { dispose(); }
    });
  };
  const runtime = buildWikiSearchRuntimeForPages([], new Set());
  runtime.searchAsync = async (query, page, pageSize) => {
    const result = await request({ kind: "query", query, page, pageSize });
    if (result.kind !== "results") throw new Error("全文搜索返回无效结果。");
    return result.results;
  };
  return {
    runtime,
    async initialize(bytes, pageIds) {
      const result = await request({ kind: "initialize", bytes, pageIds }, [bytes]);
      if (result.kind !== "initialized") throw new Error("全文索引未准备完成。");
      return result.status;
    },
    dispose,
  };
}
