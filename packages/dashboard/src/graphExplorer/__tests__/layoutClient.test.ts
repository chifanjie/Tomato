import { afterEach, describe, expect, it, vi } from "vitest";
import { requestSemanticLayout } from "../layoutClient.js";
import { computeLayout, type LayoutMessage, type LayoutResult } from "../../utils/layoutAlgorithm.js";

const input: LayoutMessage = {
  requestId: 7,
  nodes: [
    { id: "a", width: 248, height: 124 },
    { id: "b", width: 248, height: 124 },
    { id: "c", width: 248, height: 124 },
  ],
  edges: [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
  ],
  direction: "LR",
};

class ControlledWorker {
  onmessage: ((event: MessageEvent<LayoutResult>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: LayoutMessage[] = [];
  terminateCalls = 0;
  postMessageError: Error | null = null;

  postMessage(message: LayoutMessage) {
    this.posted.push(message);
    if (this.postMessageError) throw this.postMessageError;
  }

  terminate() {
    this.terminateCalls += 1;
  }

  emitResult(result = computeLayout(input)) {
    this.onmessage?.({ data: result } as MessageEvent<LayoutResult>);
  }

  emitError() {
    this.onerror?.({} as ErrorEvent);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("semantic layout client", () => {
  it("uses the same deterministic positions without Worker support", async () => {
    const expected = computeLayout(input);
    const actual = await requestSemanticLayout(input, { createWorker: null });

    expect(actual).toEqual({ ...expected, execution: "synchronous" });
  });

  it("accepts a one-shot worker result and cleans up exactly once", async () => {
    const worker = new ControlledWorker();
    const pending = requestSemanticLayout(input, { createWorker: () => worker });

    worker.emitResult();
    worker.emitError();

    await expect(pending).resolves.toEqual({
      ...computeLayout(input),
      execution: "worker",
    });
    expect(worker.posted).toEqual([input]);
    expect(worker.terminateCalls).toBe(1);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
  });

  it("rejects an already-aborted request without creating a worker", async () => {
    const controller = new AbortController();
    const createWorker = vi.fn(() => new ControlledWorker());
    controller.abort();

    await expect(requestSemanticLayout(input, {
      createWorker,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("rejects and terminates when a custom factory aborts during creation", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const worker = new ControlledWorker();
    const settled = requestSemanticLayout(input, {
      createWorker: () => {
        controller.abort();
        return worker;
      },
      signal: controller.signal,
      timeoutMs: 25,
    }).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(25);

    await expect(settled).resolves.toMatchObject({ name: "AbortError" });
    expect(worker.terminateCalls).toBe(1);
  });

  it("aborts an in-flight worker immediately and ignores late completion", async () => {
    vi.useFakeTimers();
    const worker = new ControlledWorker();
    const controller = new AbortController();
    const pending = requestSemanticLayout(input, {
      createWorker: () => worker,
      signal: controller.signal,
      timeoutMs: 50,
    });
    const settled = pending.catch((error: unknown) => error);

    controller.abort();
    worker.emitResult();
    await vi.advanceTimersByTimeAsync(100);

    await expect(settled).resolves.toMatchObject({ name: "AbortError" });
    expect(worker.terminateCalls).toBe(1);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back after a timeout and terminates the worker", async () => {
    vi.useFakeTimers();
    const worker = new ControlledWorker();
    const pending = requestSemanticLayout(input, {
      createWorker: () => worker,
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toEqual({
      ...computeLayout(input),
      execution: "synchronous",
    });
    expect(worker.terminateCalls).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back once when the worker reports an error", async () => {
    const worker = new ControlledWorker();
    const pending = requestSemanticLayout(input, { createWorker: () => worker });

    worker.emitError();
    worker.emitResult();

    await expect(pending).resolves.toEqual({
      ...computeLayout(input),
      execution: "synchronous",
    });
    expect(worker.terminateCalls).toBe(1);
  });

  it("falls back safely when worker creation throws", async () => {
    const result = await requestSemanticLayout(input, {
      createWorker: () => {
        throw new Error("constructor failed");
      },
    });

    expect(result).toEqual({ ...computeLayout(input), execution: "synchronous" });
  });

  it("falls back safely when postMessage throws and still terminates", async () => {
    const worker = new ControlledWorker();
    worker.postMessageError = new Error("clone failed");

    await expect(requestSemanticLayout(input, {
      createWorker: () => worker,
    })).resolves.toEqual({
      ...computeLayout(input),
      execution: "synchronous",
    });
    expect(worker.terminateCalls).toBe(1);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
  });
});
