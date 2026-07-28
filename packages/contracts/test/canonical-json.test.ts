import { describe, expect, it } from "vitest";
import {
  CanonicalJsonError,
  canonicalizeJson,
  cloneCanonicalJson,
} from "../src/canonical-json.js";

describe("canonical JSON", () => {
  it("sorts object keys recursively without changing array order", () => {
    const left = {
      z: [{ b: 2, a: 1 }, true],
      a: { y: "值", x: null },
      n: -0,
    };
    const right = {
      n: 0,
      a: { x: null, y: "值" },
      z: [{ a: 1, b: 2 }, true],
    };

    expect(canonicalizeJson(left)).toBe(
      '{"a":{"x":null,"y":"值"},"n":0,"z":[{"a":1,"b":2},true]}',
    );
    expect(canonicalizeJson(left)).toBe(canonicalizeJson(right));
  });

  it("returns a detached canonical JSON clone", () => {
    const source = { z: 2, nested: { b: 2, a: 1 } };
    const clone = cloneCanonicalJson(source);

    expect(clone).toEqual({ nested: { a: 1, b: 2 }, z: 2 });
    expect(clone).not.toBe(source);
    expect((clone as { nested: object }).nested).not.toBe(source.nested);
  });

  it.each([
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1n,
    new Date("2026-07-28T00:00:00Z"),
  ])("rejects non-JSON value %s", (value) => {
    expect(() => canonicalizeJson(value)).toThrow(CanonicalJsonError);
  });

  it("rejects cycles, sparse arrays, accessors, and symbol properties", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalizeJson(cyclic)).toThrow(/cycle/u);

    const sparse = new Array<unknown>(2);
    sparse[1] = "value";
    expect(() => canonicalizeJson(sparse)).toThrow(/sparse/u);

    const accessor = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => "value",
    });
    expect(() => canonicalizeJson(accessor)).toThrow(/plain enumerable data property/u);

    const symbolObject = { value: 1, [Symbol("hidden")]: 2 };
    expect(() => canonicalizeJson(symbolObject)).toThrow(/symbol/u);
  });
});
