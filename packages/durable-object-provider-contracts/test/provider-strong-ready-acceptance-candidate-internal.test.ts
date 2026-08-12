import { describe, expect, it } from "vitest";

import {
  ProviderStrongReadyActiveWriterSelectionErrorInternalV1,
  classifyProviderStrongReadyActiveWriterMatchCountInternalV1,
} from "../src/provider-strong-ready-acceptance-candidate-internal.js";

describe("Provider strong-ready active-writer exact-cardinality guard", () => {
  it("accepts exactly one match", () => {
    expect(classifyProviderStrongReadyActiveWriterMatchCountInternalV1(1))
      .toBe("unique");
  });

  it.each([
    [0, "zero_match"],
    [2, "ambiguous_match"],
    [4096, "ambiguous_match"],
    [-1, "source_invalid"],
    [1.5, "source_invalid"],
    [Number.MAX_SAFE_INTEGER + 1, "source_invalid"],
  ] as const)("rejects cardinality %s as %s", (count, reason) => {
    expect(() =>
      classifyProviderStrongReadyActiveWriterMatchCountInternalV1(count)
    ).toThrowError(
      expect.objectContaining({
        name: "ProviderStrongReadyActiveWriterSelectionErrorInternalV1",
        reason,
      }),
    );
    try {
      classifyProviderStrongReadyActiveWriterMatchCountInternalV1(count);
    } catch (error) {
      expect(error).toBeInstanceOf(
        ProviderStrongReadyActiveWriterSelectionErrorInternalV1,
      );
      expect(Object.isFrozen(error)).toBe(true);
    }
  });

  it("does not late-bind Number.isSafeInteger after module initialization", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Number,
      "isSafeInteger",
    );
    if (descriptor === undefined) {
      throw new TypeError("Number.isSafeInteger descriptor unavailable");
    }
    let poisonCalls = 0;
    try {
      Object.defineProperty(Number, "isSafeInteger", {
        ...descriptor,
        value() {
          poisonCalls += 1;
          throw new TypeError("late-bound Number.isSafeInteger");
        },
      });
      expect(classifyProviderStrongReadyActiveWriterMatchCountInternalV1(1))
        .toBe("unique");
    } finally {
      Object.defineProperty(Number, "isSafeInteger", descriptor);
    }
    expect(poisonCalls).toBe(0);
  });
});
