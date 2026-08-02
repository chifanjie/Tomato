import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { sha256InternalV1 } from "../src/sha256.js";

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

describe("internal portable SHA-256", () => {
  it("matches the standard empty and abc vectors", () => {
    expect(hex(sha256InternalV1(new Uint8Array()))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(hex(sha256InternalV1(new TextEncoder().encode("abc")))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches Node across padding boundaries and a large capped resource", () => {
    for (const length of [
      1, 31, 32, 55, 56, 57, 63, 64, 65, 127, 128, 129, 1023, 1024,
      4096, 65_537,
    ]) {
      const message = new Uint8Array(length);
      for (let index = 0; index < message.byteLength; index += 1) {
        message[index] = (index * 131 + length) & 0xff;
      }
      expect(hex(sha256InternalV1(message)), String(length)).toBe(
        createHash("sha256").update(message).digest("hex"),
      );
    }
  });

  it("rejects non-byte input at runtime", () => {
    expect(() =>
      sha256InternalV1("abc" as unknown as Uint8Array),
    ).toThrow(/Uint8Array/u);
  });
});
