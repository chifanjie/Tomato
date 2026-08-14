import { describe, expect, it } from "vitest";

import {
  ProviderCanonicalJsonError,
  canonicalizeJcsSafeIntegerUtf8V1,
  canonicalizeJcsSafeIntegerV1,
  parseCanonicalJcsSafeIntegerUtf8V1,
} from "../src/jcs.js";

const encoder = new TextEncoder();

describe("rfc8785-jcs-safe-integer-v1", () => {
  it("sorts every object level by UTF-16 code units and preserves arrays", () => {
    const value = {
      nested: {
        "\ue000": "bmp",
        "😀": "astral",
        "e\u0301": "nfd",
        a: "é",
        A: "line\n",
      },
      array: [3, 1, 2],
    };
    expect(canonicalizeJcsSafeIntegerV1(value)).toBe(
      '{"array":[3,1,2],"nested":{"A":"line\\n","a":"é","é":"nfd","😀":"astral","":"bmp"}}',
    );
  });

  it("does not normalize Unicode and emits exact UTF-8 without a BOM or newline", () => {
    const nfc = canonicalizeJcsSafeIntegerUtf8V1(["é"]);
    const nfd = canonicalizeJcsSafeIntegerUtf8V1(["e\u0301"]);
    expect([...nfc]).not.toEqual([...nfd]);
    expect(new TextDecoder().decode(nfc)).toBe('["é"]');
    expect(nfc.slice(0, 3)).not.toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
    expect(nfc.at(-1)).not.toBe(0x0a);
  });

  it.each([
    1.5,
    -0,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("rejects forbidden number %s", (value) => {
    expect(() => canonicalizeJcsSafeIntegerV1(value)).toThrow(
      ProviderCanonicalJsonError,
    );
  });

  it.each([
    undefined,
    BigInt(1),
    () => undefined,
    Symbol("fixture"),
    new Date(0),
  ])("rejects a non-JSON runtime value", (value) => {
    expect(() => canonicalizeJcsSafeIntegerV1(value)).toThrow(
      ProviderCanonicalJsonError,
    );
  });

  it("rejects sparse arrays, extra array properties, and symbol properties", () => {
    const sparse = [1, 2];
    delete sparse[0];
    const extra = [1] as unknown[] & { extra?: number };
    extra.extra = 2;
    const withSymbol = { value: 1 } as Record<PropertyKey, unknown>;
    withSymbol[Symbol("fixture")] = 2;
    expect(() => canonicalizeJcsSafeIntegerV1(sparse)).toThrow(/sparse/u);
    expect(() => canonicalizeJcsSafeIntegerV1(extra)).toThrow(/non-index/u);
    expect(() => canonicalizeJcsSafeIntegerV1(withSymbol)).toThrow(/symbol/u);
  });

  it("rejects getters without invoking them and rejects hidden data", () => {
    let invoked = false;
    const getter = Object.defineProperty({}, "value", {
      enumerable: true,
      get() {
        invoked = true;
        return 1;
      },
    });
    const hidden = Object.defineProperty({}, "value", {
      enumerable: false,
      value: 1,
    });
    expect(() => canonicalizeJcsSafeIntegerV1(getter)).toThrow(/data property/u);
    expect(invoked).toBe(false);
    expect(() => canonicalizeJcsSafeIntegerV1(hidden)).toThrow(/enumerable/u);
  });

  it("rejects cycles but permits repeated acyclic values", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalizeJcsSafeIntegerV1(cyclic)).toThrow(/cycle/u);

    const shared = { value: 1 };
    expect(canonicalizeJcsSafeIntegerV1([shared, shared])).toBe(
      '[{"value":1},{"value":1}]',
    );
  });

  it.each(["\ud800", "\udfff", `ok\ud800bad`])(
    "rejects lone surrogate code units",
    (value) => {
      expect(() => canonicalizeJcsSafeIntegerV1(value)).toThrow(/surrogate/u);
    },
  );

  it("does not late-bind String.prototype.charCodeAt after module initialization", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      String.prototype,
      "charCodeAt",
    );
    if (descriptor === undefined) throw new TypeError("charCodeAt missing");
    let invoked = false;
    Object.defineProperty(String.prototype, "charCodeAt", {
      configurable: true,
      writable: true,
      value() {
        invoked = true;
        throw new Error("poisoned charCodeAt");
      },
    });
    try {
      expect(canonicalizeJcsSafeIntegerV1({ value: "😀" })).toBe(
        '{"value":"😀"}',
      );
      expect(invoked).toBe(false);
    } finally {
      Object.defineProperty(String.prototype, "charCodeAt", descriptor);
    }
  });

  it("does not late-bind Array.prototype iteration after module initialization", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator,
    );
    if (descriptor === undefined) throw new TypeError("Array iterator missing");
    let invoked = false;
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      configurable: true,
      writable: true,
      value: function* poisonedArrayIterator() {
        invoked = true;
      },
    });
    try {
      expect(canonicalizeJcsSafeIntegerV1({ b: 2, a: 1 })).toBe(
        '{"a":1,"b":2}',
      );
      expect(canonicalizeJcsSafeIntegerV1([3, 2, 1])).toBe("[3,2,1]");
      expect(invoked).toBe(false);
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, descriptor);
    }
  });

  it("does not late-bind UTF-8 and typed-array primordials after module initialization", () => {
    const encoderDescriptor = Object.getOwnPropertyDescriptor(
      TextEncoder.prototype,
      "encode",
    );
    const decoderDescriptor = Object.getOwnPropertyDescriptor(
      TextDecoder.prototype,
      "decode",
    );
    const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
    const byteLengthDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "byteLength",
    );
    if (
      encoderDescriptor === undefined ||
      decoderDescriptor === undefined ||
      byteLengthDescriptor === undefined
    ) {
      throw new TypeError("UTF-8 or typed-array primordial missing");
    }
    let invoked = false;
    Object.defineProperty(TextEncoder.prototype, "encode", {
      configurable: true,
      writable: true,
      value() {
        invoked = true;
        throw new Error("poisoned TextEncoder.encode");
      },
    });
    Object.defineProperty(TextDecoder.prototype, "decode", {
      configurable: true,
      writable: true,
      value() {
        invoked = true;
        throw new Error("poisoned TextDecoder.decode");
      },
    });
    Object.defineProperty(typedArrayPrototype, "byteLength", {
      configurable: true,
      get() {
        invoked = true;
        throw new Error("poisoned TypedArray.byteLength");
      },
    });
    try {
      const canonical = canonicalizeJcsSafeIntegerUtf8V1({ a: 1 });
      expect(parseCanonicalJcsSafeIntegerUtf8V1(canonical)).toEqual({ a: 1 });
      expect(invoked).toBe(false);
    } finally {
      Object.defineProperty(
        TextEncoder.prototype,
        "encode",
        encoderDescriptor,
      );
      Object.defineProperty(
        TextDecoder.prototype,
        "decode",
        decoderDescriptor,
      );
      Object.defineProperty(
        typedArrayPrototype,
        "byteLength",
        byteLengthDescriptor,
      );
    }
  });

  it("accepts only byte-for-byte canonical messages", () => {
    const canonical = encoder.encode('{"a":1,"b":[2,3]}');
    expect(parseCanonicalJcsSafeIntegerUtf8V1(canonical)).toEqual({
      a: 1,
      b: [2, 3],
    });

    for (const invalid of [
      encoder.encode('{"b":[2,3],"a":1}'),
      encoder.encode('{"a":1,"a":1}'),
      encoder.encode("{\"a\":1}\n"),
      encoder.encode(" 1"),
      encoder.encode("1.0"),
      encoder.encode("-0"),
      new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]),
      new Uint8Array([0xff]),
    ]) {
      expect(() => parseCanonicalJcsSafeIntegerUtf8V1(invalid)).toThrow(
        ProviderCanonicalJsonError,
      );
    }
  });
});
