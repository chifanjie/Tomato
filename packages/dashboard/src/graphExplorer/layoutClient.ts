import {
  computeLayout,
  type LayoutMessage,
  type LayoutResult,
} from "../utils/layoutAlgorithm.js";

export interface WorkerLike {
  postMessage(message: LayoutMessage): void;
  onmessage: ((event: MessageEvent<LayoutResult>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

export interface SemanticLayoutResult extends LayoutResult {
  execution: "worker" | "synchronous";
}

export type WorkerFactory = (() => WorkerLike | null) | null;

export interface SemanticLayoutOptions {
  createWorker?: WorkerFactory;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function defaultWorkerFactory(): WorkerLike | null {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("../utils/layout.worker.ts", import.meta.url), { type: "module" });
}

function synchronousResult(input: LayoutMessage): SemanticLayoutResult {
  return { ...computeLayout(input), execution: "synchronous" };
}

function abortError(): Error {
  const error = new Error("Semantic layout request was aborted");
  error.name = "AbortError";
  return error;
}

export async function requestSemanticLayout(
  input: LayoutMessage,
  options: SemanticLayoutOptions = {},
): Promise<SemanticLayoutResult> {
  if (options.signal?.aborted) throw abortError();

  let worker: WorkerLike | null;
  try {
    worker = options.createWorker === undefined
      ? defaultWorkerFactory()
      : options.createWorker?.() ?? null;
  } catch {
    return synchronousResult(input);
  }

  if (options.signal?.aborted) {
    try {
      worker?.terminate();
    } catch {
      // Abort remains authoritative even if Worker cleanup fails.
    }
    throw abortError();
  }
  if (!worker) return synchronousResult(input);

  return await new Promise<SemanticLayoutResult>((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;

    const cleanup = () => {
      if (timeout !== null) {
        globalThis.clearTimeout(timeout);
        timeout = null;
      }
      worker.onmessage = null;
      worker.onerror = null;
      options.signal?.removeEventListener("abort", handleAbort);
      try {
        worker.terminate();
      } catch {
        // Cleanup must not replace the original result or error.
      }
    };

    const finish = (
      result: SemanticLayoutResult | Error,
      outcome: "resolve" | "reject",
    ) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (outcome === "resolve") resolve(result as SemanticLayoutResult);
      else reject(result);
    };

    const fallback = () => {
      try {
        finish(synchronousResult(input), "resolve");
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)), "reject");
      }
    };

    function handleAbort() {
      finish(abortError(), "reject");
    }

    options.signal?.addEventListener("abort", handleAbort, { once: true });
    timeout = globalThis.setTimeout(fallback, options.timeoutMs ?? 8_000);
    worker.onmessage = (event) => {
      if (event.data.requestId !== input.requestId) {
        fallback();
        return;
      }
      finish({ ...event.data, execution: "worker" }, "resolve");
    };
    worker.onerror = fallback;

    try {
      worker.postMessage(input);
    } catch {
      fallback();
    }
  });
}
