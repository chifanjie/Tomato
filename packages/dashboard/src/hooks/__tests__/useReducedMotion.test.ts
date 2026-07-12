import { describe, expect, it, vi } from "vitest";
import { observeReducedMotion, REDUCED_MOTION_QUERY } from "../useReducedMotion";

describe("observeReducedMotion", () => {
  it("reports the initial preference, subscribes to changes, and removes the same listener", () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const addEventListener = vi.fn((_type: string, next: (event: MediaQueryListEvent) => void) => {
      listener = next;
    });
    const removeEventListener = vi.fn();
    const matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener,
      removeEventListener,
    }) as unknown as Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">);
    const notifications: boolean[] = [];

    const cleanup = observeReducedMotion(matchMedia, (reduced) => notifications.push(reduced));
    listener?.({ matches: false } as MediaQueryListEvent);
    cleanup();

    expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
    expect(notifications).toEqual([true, false]);
    expect(addEventListener).toHaveBeenCalledWith("change", listener);
    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});
