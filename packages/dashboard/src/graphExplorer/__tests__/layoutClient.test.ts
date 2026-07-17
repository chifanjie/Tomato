import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSemanticLayoutCache,
  requestSemanticLayout,
} from "../layoutClient.js";
import {
  computeLayout,
  computeStableGridLayout,
  quantizeGraphViewport,
  type LayoutMessage,
  type LayoutResult,
} from "../../utils/layoutAlgorithm.js";

function message(requestId = 7, structureKey = "structure:alpha"): LayoutMessage {
  return {
    requestId,
    structureKey,
    level: "scope",
    viewport: quantizeGraphViewport(960, 650),
    nodes: [
      { id: "a", width: 248, height: 124, kind: "cluster" },
      { id: "b", width: 220, height: 104, kind: "file" },
      { id: "c", width: 188, height: 72, kind: "symbol" },
    ],
    edges: [
      {
        source: "a",
        target: "b",
        relationType: "depends_on",
        directions: ["forward"],
        weight: 0.8,
        count: 1,
      },
      {
        source: "b",
        target: "c",
        relationType: "contains",
        directions: ["forward"],
        weight: 1,
        count: 1,
      },
    ],
  };
}

class ControlledWorker {
  onmessage: ((event: MessageEvent<LayoutResult>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: LayoutMessage[] = [];
  terminateCalls = 0;
  postMessageError: Error | null = null;

  postMessage(input: LayoutMessage): void {
    this.posted.push(input);
    if (this.postMessageError) throw this.postMessageError;
  }

  terminate(): void {
    this.terminateCalls += 1;
  }

  emitResult(result: unknown = computeLayout(this.posted[0] ?? message())): void {
    this.onmessage?.({ data: result } as MessageEvent<LayoutResult>);
  }

  emitError(): void {
    this.onerror?.({} as ErrorEvent);
  }
}

beforeEach(() => {
  clearSemanticLayoutCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("semantic layout fallback pipeline", () => {
  it("returns a valid worker result without running fallbacks", async () => {
    const input = message();
    const worker = new ControlledWorker();
    const compute = vi.fn(computeLayout);
    const computeGrid = vi.fn(computeStableGridLayout);
    const pending = requestSemanticLayout(input, {
      createWorker: () => worker,
      compute,
      computeGrid,
    });

    worker.emitResult();

    await expect(pending).resolves.toEqual({
      ...computeLayout(input),
      execution: "worker",
      degraded: false,
    });
    expect(compute).not.toHaveBeenCalled();
    expect(computeGrid).not.toHaveBeenCalled();
    expect(worker.terminateCalls).toBe(1);
  });

  it("falls back from worker error to synchronous layout exactly once", async () => {
    const input = message();
    const worker = new ControlledWorker();
    const compute = vi.fn(computeLayout);
    const pending = requestSemanticLayout(input, { createWorker: () => worker, compute });

    worker.emitError();
    worker.emitResult();

    await expect(pending).resolves.toEqual({
      ...computeLayout(input),
      execution: "synchronous",
      degraded: false,
    });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(worker.terminateCalls).toBe(1);
  });

  it("validates worker output before accepting it", async () => {
    const input = message();
    const worker = new ControlledWorker();
    const compute = vi.fn(computeLayout);
    const pending = requestSemanticLayout(input, { createWorker: () => worker, compute });

    worker.emitResult({ requestId: input.requestId, positions: {}, bounds: { x: 0, y: 0, width: 0, height: 0 } });

    await expect(pending).resolves.toMatchObject({ execution: "synchronous", degraded: false });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("falls through malformed worker and synchronous payloads to the stable grid", async () => {
    const input = message();
    const malformed = {
      requestId: input.requestId,
      positions: null,
      bounds: null,
    };
    const worker = new ControlledWorker();
    const compute = vi.fn(() => malformed as unknown as LayoutResult);
    const computeGrid = vi.fn(computeStableGridLayout);
    const pending = requestSemanticLayout(input, {
      createWorker: () => worker,
      compute,
      computeGrid,
    });

    worker.emitResult(malformed);

    await expect(pending).resolves.toEqual({
      ...computeStableGridLayout(input),
      execution: "grid",
      degraded: true,
    });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(computeGrid).toHaveBeenCalledTimes(1);
  });

  it("uses a degraded stable grid when synchronous output is invalid", async () => {
    const input = message();
    const compute = vi.fn((): LayoutResult => ({
      requestId: input.requestId,
      positions: {},
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    }));
    const computeGrid = vi.fn(computeStableGridLayout);

    await expect(requestSemanticLayout(input, {
      createWorker: null,
      compute,
      computeGrid,
    })).resolves.toEqual({
      ...computeStableGridLayout(input),
      execution: "grid",
      degraded: true,
    });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(computeGrid).toHaveBeenCalledTimes(1);
  });

  it("uses the stable grid when worker construction and synchronous layout both fail", async () => {
    const input = message();
    const computeGrid = vi.fn(computeStableGridLayout);
    const result = await requestSemanticLayout(input, {
      createWorker: () => { throw new Error("constructor failed"); },
      compute: () => { throw new Error("dagre failed"); },
      computeGrid,
    });

    expect(result).toEqual({ ...computeStableGridLayout(input), execution: "grid", degraded: true });
    expect(computeGrid).toHaveBeenCalledTimes(1);
  });

  it("rejects when the injected stable grid also returns an invalid result", async () => {
    const input = message();
    const invalid = (): LayoutResult => ({
      requestId: input.requestId,
      positions: {},
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    });

    await expect(requestSemanticLayout(input, {
      createWorker: null,
      compute: invalid,
      computeGrid: invalid,
    })).rejects.toThrow("Unable to produce a valid semantic graph layout");
  });
});

describe("semantic layout cache", () => {
  it("keys cache by structure, level, viewport, and layout versions and uses the current request id", async () => {
    const first = message(1);
    const createWorker = vi.fn(() => null);
    const firstResult = await requestSemanticLayout(first, { createWorker });
    const secondResult = await requestSemanticLayout(message(2), { createWorker });

    expect(firstResult.execution).toBe("synchronous");
    expect(secondResult).toEqual({
      ...firstResult,
      requestId: 2,
      execution: "cache",
    });
    expect(createWorker).toHaveBeenCalledTimes(1);

    await requestSemanticLayout({ ...message(3), level: "cluster" }, { createWorker });
    await requestSemanticLayout({
      ...message(4),
      viewport: quantizeGraphViewport(1840, 720),
    }, { createWorker });
    expect(createWorker).toHaveBeenCalledTimes(3);
  });

  it("retains degraded state on a cache hit", async () => {
    const invalid = (): LayoutResult => ({
      requestId: 1,
      positions: {},
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    });
    const first = await requestSemanticLayout(message(1), {
      createWorker: null,
      compute: invalid,
    });
    const second = await requestSemanticLayout(message(2), {
      createWorker: () => { throw new Error("cache miss"); },
      compute: invalid,
    });

    expect(first).toMatchObject({ execution: "grid", degraded: true });
    expect(second).toMatchObject({ requestId: 2, execution: "cache", degraded: true });
  });

  it("evicts the least-recently-used entry after 24 cached structures", async () => {
    const compute = vi.fn(computeLayout);
    for (let index = 0; index < 25; index += 1) {
      await requestSemanticLayout(message(index + 1, `structure:${index}`), {
        createWorker: null,
        compute,
      });
    }
    expect(compute).toHaveBeenCalledTimes(25);

    await requestSemanticLayout(message(100, "structure:0"), { createWorker: null, compute });
    expect(compute).toHaveBeenCalledTimes(26);

    await requestSemanticLayout(message(101, "structure:24"), { createWorker: null, compute });
    expect(compute).toHaveBeenCalledTimes(26);
  });
});

describe("semantic layout cancellation and timeout", () => {
  it("makes abort authoritative over an existing cache entry", async () => {
    await requestSemanticLayout(message(1), { createWorker: null });
    const controller = new AbortController();
    const createWorker = vi.fn(() => new ControlledWorker());
    controller.abort();

    await expect(requestSemanticLayout(message(2), {
      createWorker,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("terminates an in-flight worker, rejects AbortError, and never caches late output", async () => {
    const input = message(1);
    const worker = new ControlledWorker();
    const controller = new AbortController();
    const pending = requestSemanticLayout(input, {
      createWorker: () => worker,
      signal: controller.signal,
    });

    controller.abort();
    worker.emitResult();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminateCalls).toBe(1);
    const compute = vi.fn(computeLayout);
    await requestSemanticLayout(message(2), { createWorker: null, compute });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("terminates a worker when its factory synchronously aborts before returning", async () => {
    const controller = new AbortController();
    const worker = new ControlledWorker();

    await expect(requestSemanticLayout(message(), {
      createWorker: () => {
        controller.abort();
        return worker;
      },
      signal: controller.signal,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminateCalls).toBe(1);
    expect(worker.posted).toEqual([]);
  });

  it("uses the 4000ms default timeout before falling back synchronously", async () => {
    vi.useFakeTimers();
    const input = message();
    const worker = new ControlledWorker();
    const compute = vi.fn(computeLayout);
    const pending = requestSemanticLayout(input, { createWorker: () => worker, compute });
    let settled = false;
    void pending.finally(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(3_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toMatchObject({ execution: "synchronous", degraded: false });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(worker.terminateCalls).toBe(1);
  });

  it("honors an injected worker timeout", async () => {
    vi.useFakeTimers();
    const worker = new ControlledWorker();
    const pending = requestSemanticLayout(message(), {
      createWorker: () => worker,
      workerTimeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toMatchObject({ execution: "synchronous" });
    expect(worker.terminateCalls).toBe(1);
  });
});
