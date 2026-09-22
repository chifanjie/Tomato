import { AsyncLocalStorage } from "node:async_hooks";
import { setImmediate } from "node:timers/promises";

export interface OperationControl {
  readonly signal?: AbortSignal;
  readonly onProgress?: (message: string) => void | Promise<void>;
}

const operation = new AsyncLocalStorage<{ control: OperationControl; phase?: string; reportedAt: number }>();

export class OperationCancelledError extends Error {
  constructor() {
    super("Operation cancelled before its next commit. Completed commits are preserved; retry the same request to continue.");
    this.name = "OperationCancelledError";
  }
}

export function runWithOperationControl<T>(control: OperationControl, action: () => Promise<T>): Promise<T> {
  return operation.run({ control, reportedAt: 0 }, action);
}

export function throwIfOperationCancelled(): void {
  if (operation.getStore()?.control.signal?.aborted) throw new OperationCancelledError();
}

/** Call between bounded work units and before an atomic commit, never during one. */
export async function operationCheckpoint(message?: string): Promise<void> {
  const state = operation.getStore();
  if (state === undefined) return;
  throwIfOperationCancelled();
  if (message !== undefined) state.phase = message;
  // Bounded scan checkpoints also keep a long phase visibly alive, without a
  // background timer or unsolicited notifications to clients lacking a token.
  if (state.phase !== undefined && (message !== undefined || Date.now() - state.reportedAt >= 1_000)) {
    await state.control.onProgress?.(state.phase);
    state.reportedAt = Date.now();
  }
  await setImmediate();
  throwIfOperationCancelled();
}
