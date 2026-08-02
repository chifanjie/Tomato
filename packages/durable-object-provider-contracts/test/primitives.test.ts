import { describe, expect, it } from "vitest";

import {
  CanonicalByteStringV1Schema,
  CanonicalPublicKeyBytes32V1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  DurableObjectIdentityProviderSlugV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex22V1Schema,
  LowerHex32V1Schema,
  LowerHex64V1Schema,
  ProviderRegistryRootKeyIdV1Schema,
  createDurableObjectIdentityProviderIdV1,
} from "../src/primitives.js";

describe("provider contract primitives", () => {
  it("accepts only canonical unpadded base64url", () => {
    for (const value of [
      "base64url:",
      "base64url:AA",
      "base64url:_w",
      "base64url:AAA",
      "base64url:__8",
      "base64url:AAAA",
    ]) {
      expect(CanonicalByteStringV1Schema.parse(value)).toBe(value);
    }
    for (const value of [
      "base64url:A",
      "base64url:AB",
      "base64url:AAF",
      "base64url:AA=",
      "base64url:AA+",
      "AA",
    ]) {
      expect(() => CanonicalByteStringV1Schema.parse(value)).toThrow();
    }
  });

  it("accepts every valid trailing-bit class for an exact 32-byte key", () => {
    for (const finalCharacter of "AEIMQUYcgkosw048") {
      const value = `base64url:${"A".repeat(42)}${finalCharacter}`;
      expect(CanonicalPublicKeyBytes32V1Schema.parse(value)).toBe(value);
    }
    for (const value of [
      `base64url:${"A".repeat(42)}B`,
      `base64url:${"A".repeat(42)}`,
      `base64url:${"A".repeat(44)}`,
    ]) {
      expect(() => CanonicalPublicKeyBytes32V1Schema.parse(value)).toThrow();
    }
  });

  it("validates provider slug boundaries and constructs the only legal ID form", () => {
    for (const slug of ["a", "native-fs", "native.fs_2", "a".repeat(64)]) {
      const branded = DurableObjectIdentityProviderSlugV1Schema.parse(slug);
      expect(createDurableObjectIdentityProviderIdV1(branded)).toBe(
        `durable-object-provider:${slug}`,
      );
    }
    for (const slug of [
      "Native",
      "-native",
      "native-",
      "native..fs",
      "a".repeat(65),
      "",
    ]) {
      expect(() => DurableObjectIdentityProviderSlugV1Schema.parse(slug)).toThrow();
    }
    expect(() => DurableObjectIdentityProviderIdV1Schema.parse("provider:native")).toThrow();
  });

  it("keeps same-shape semantic primitives as independent schemas", () => {
    const hex22 = "a".repeat(22);
    expect(LowerHex22V1Schema.parse(hex22)).toBe(hex22);
    expect(ProviderRegistryRootKeyIdV1Schema.parse(hex22)).toBe(hex22);
    expect(LowerHex32V1Schema.parse("b".repeat(32))).toBe("b".repeat(32));
    expect(LowerHex64V1Schema.parse("c".repeat(64))).toBe("c".repeat(64));
    expect(ContentDigestV1Schema.parse(`sha256:${"d".repeat(64)}`)).toBe(
      `sha256:${"d".repeat(64)}`,
    );
    expect(KeyedStateTokenV1Schema.parse(`hmac-sha256:${"e".repeat(64)}`)).toBe(
      `hmac-sha256:${"e".repeat(64)}`,
    );
    expect(
      InstallationIdentityGenerationIdV1Schema.parse(
        `installation-identity-generation:${hex22}`,
      ),
    ).toBe(`installation-identity-generation:${hex22}`);
    expect(() => LowerHex22V1Schema.parse("A".repeat(22))).toThrow();
    expect(() => ProviderRegistryRootKeyIdV1Schema.parse("a".repeat(21))).toThrow();
  });
});
