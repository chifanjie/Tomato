import {
  GRAPH_LAYOUT_ALGORITHM_VERSION,
  GRAPH_LAYOUT_DENSITY_VERSION,
  computeLayout,
  computeStableGridLayout,
  isValidLayoutResult,
  type LayoutMessage,
  type LayoutResult,
} from "../utils/layoutAlgorithm.js";

export interface WorkerLike {
  postMessage(message: LayoutMessage): void;
  onmessage: ((event: MessageEvent<LayoutResult>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

export type WorkerFactory = (() => WorkerLike | null) | null;

export interface SemanticLayoutResult extends LayoutResult {
  execution: "worker" | "synchronous" | "grid" | "cache";
  degraded: boolean;
}

export interface SemanticLayoutOptions {
  createWorker?: WorkerFactory;
  workerTimeoutMs?: number;
  compute?: typeof computeLayout;
  computeGrid?: typeof computeStableGridLayout;
  signal?: AbortSignal;
}

interface CachedLayout {
  result: LayoutResult;
  degraded: boolean;
}

const MAX_CACHE_ENTRIES = 24;
const DEFAULT_WORKER_TIMEOUT_MS = 4_000;
const layoutCache = new Map<string, CachedLayout>();

function defaultWorkerFactory(): WorkerLike | null {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("../utils/layout.worker.ts", import.meta.url), { type: "module" });
}

function abortError(): Error {
  const error = new Error("Semantic layout request was aborted");
  error.name = "AbortError";
  return error;
}

function cacheKey(input: LayoutMessage): string {
  return [
    GRAPH_LAYOUT_ALGORITHM_VERSION,
    GRAPH_LAYOUT_DENSITY_VERSION,
    input.structureKey,
    input.level,
    input.viewport.width,
    input.viewport.height,
    input.viewport.widthBucket,
    input.viewport.heightBucket,
    input.viewport.aspectBucket,
  ].join("\u0000");
}

function readCache(input: LayoutMessage): SemanticLayoutResult | null {
  const key = cacheKey(input);
  const cached = layoutCache.get(key);
  if (!cached) return null;
  layoutCache.delete(key);
  layoutCache.set(key, cached);
  return {
    ...cached.result,
    requestId: input.requestId,
    execution: "cache",
    degraded: cached.degraded,
  };
}

function writeCache(input: LayoutMessage, result: LayoutResult, degraded: boolean): void {
  const key = cacheKey(input);
  layoutCache.delete(key);
  layoutCache.set(key, { result: { ...result }, degraded });
  while (layoutCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = layoutCache.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    layoutCache.delete(oldestKey);
  }
}

export function clearSemanticLayoutCache(): void {
  layoutCache.clear();
}

function terminateWorker(worker: WorkerLike | null): void {
  if (!worker) return;
  try {
    worker.terminate();
  } catch {
    // Cleanup cannot replace the authoritative layout/abort outcome.
  }
}

async function requestWorkerLayout(
  worker: WorkerLike,
  input: LayoutMessage,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<LayoutResult | null> {
  return await new Promise<LayoutResult | null>((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;

    const cleanup = () => {
      if (timeout !== null) globalThis.clearTimeout(timeout);
      timeout = null;
      worker.onmessage = null;
      worker.onerror = null;
      signal?.removeEventListener("abort", handleAbort);
      terminateWorker(worker);
    };
    const finish = (result: LayoutResult | null, error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(result);
    };
    function handleAbort() {
      finish(null, abortError());
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
    timeout = globalThis.setTimeout(() => finish(null), timeoutMs);
    worker.onmessage = (event) => finish(event.data);
    worker.onerror = () => finish(null);
    try {
      worker.postMessage(input);
    } catch {
      finish(null);
    }
  });
}

function ensureNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}

export async function requestSemanticLayout(
  input: LayoutMessage,
  options: SemanticLayoutOptions = {},
): Promise<SemanticLayoutResult> {
  ensureNotAborted(options.signal);
  const cached = readCache(input);
  ensureNotAborted(options.signal);
  if (cached) return cached;

  const compute = options.compute ?? computeLayout;
  const computeGrid = options.computeGrid ?? computeStableGridLayout;
  let worker: WorkerLike | null = null;
  try {
    worker = options.createWorker === undefined
      ? defaultWorkerFactory()
      : options.createWorker?.() ?? null;
  } catch {
    worker = null;
  }
  if (options.signal?.aborted) {
    terminateWorker(worker);
    throw abortError();
  }

  if (worker) {
    const workerResult = await requestWorkerLayout(
      worker,
      input,
      options.signal,
      options.workerTimeoutMs ?? DEFAULT_WORKER_TIMEOUT_MS,
    );
    ensureNotAborted(options.signal);
    if (workerResult && isValidLayoutResult(input, workerResult)) {
      writeCache(input, workerResult, false);
      return { ...workerResult, execution: "worker", degraded: false };
    }
  }

  ensureNotAborted(options.signal);
  try {
    const result = compute(input);
    ensureNotAborted(options.signal);
    if (isValidLayoutResult(input, result)) {
      writeCache(input, result, false);
      return { ...result, execution: "synchronous", degraded: false };
    }
  } catch (error) {
    ensureNotAborted(options.signal);
    if ((error as Error | undefined)?.name === "AbortError") throw error;
  }

  ensureNotAborted(options.signal);
  const gridResult = computeGrid(input);
  ensureNotAborted(options.signal);
  if (!isValidLayoutResult(input, gridResult)) {
    throw new Error("Unable to produce a valid semantic graph layout");
  }
  writeCache(input, gridResult, true);
  return { ...gridResult, execution: "grid", degraded: true };
}
