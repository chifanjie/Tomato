import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  type ProviderCryptoHostV1,
} from "./domain-crypto.js";
import {
  CanonicalPublicKeyBytes32V1Schema,
  Ed25519PublicKeyDigestV1Schema,
  type CanonicalPublicKeyBytes32V1,
  type Ed25519PublicKeyDigestV1,
} from "./primitives.js";
import { deriveProviderRegistryRootKeyIdV1 } from "./provider-foundation.js";

const BASE64URL_PREFIX = "base64url:";
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export const ED25519_PUBLIC_KEY_DIGEST_GOLDEN_RAW_HEX_V1 =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" as const;
export const ED25519_PUBLIC_KEY_DIGEST_GOLDEN_PUBLIC_KEY_BYTES_V1 =
  "base64url:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8" as const;
export const ED25519_PUBLIC_KEY_DIGEST_GOLDEN_VALUE_V1 =
  "sha256:630dcd2966c4336691125448bbb25b4ff412a49c732db2c8abc1b8581bd710dd" as const;
export const ED25519_PUBLIC_KEY_DIGEST_GOLDEN_LEGACY_ROOT_KEY_ID_V1 =
  "6e88eeded5ad931d6d2eba" as const;

export const ProviderEd25519PublicKeyDigestGoldenCaseV1Schema = z.strictObject({
  caseId: z.literal("ed25519-public-key-digest-00-through-1f-v1"),
  digestPreimageProfile: z.literal(
    "decoded-canonical-base64url-exact-raw32-v1",
  ),
  rawPublicKeyHex: z.literal(
    ED25519_PUBLIC_KEY_DIGEST_GOLDEN_RAW_HEX_V1,
  ),
  publicKeyBytes: z
    .literal(ED25519_PUBLIC_KEY_DIGEST_GOLDEN_PUBLIC_KEY_BYTES_V1)
    .brand<"CanonicalPublicKeyBytes32V1">(),
  expectedPublicKeyDigest: z
    .literal(ED25519_PUBLIC_KEY_DIGEST_GOLDEN_VALUE_V1)
    .brand<"Ed25519PublicKeyDigestV1">(),
  expectedLegacyProviderRegistryRootKeyId: z
    .literal(ED25519_PUBLIC_KEY_DIGEST_GOLDEN_LEGACY_ROOT_KEY_ID_V1)
    .brand<"ProviderRegistryRootKeyIdV1">(),
});
export type ProviderEd25519PublicKeyDigestGoldenCaseV1 = z.infer<
  typeof ProviderEd25519PublicKeyDigestGoldenCaseV1Schema
>;

export const ProviderEd25519PublicKeyDigestGoldenManifestV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    profile: z.literal(
      "provider_ed25519_public_key_digest_golden_v1",
    ),
    cases: z
      .array(ProviderEd25519PublicKeyDigestGoldenCaseV1Schema)
      .length(1),
  });
export type ProviderEd25519PublicKeyDigestGoldenManifestV1 = z.infer<
  typeof ProviderEd25519PublicKeyDigestGoldenManifestV1Schema
>;

function decodeCanonicalPublicKeyBytes32V1(
  value: CanonicalPublicKeyBytes32V1,
): Uint8Array {
  const body = value.slice(BASE64URL_PREFIX.length);
  const decoded = new Uint8Array(32);
  let accumulator = 0;
  let availableBits = 0;
  let outputOffset = 0;

  for (const character of body) {
    const digit = BASE64URL_ALPHABET.indexOf(character);
    if (digit < 0) {
      throw new TypeError("public key must use canonical unpadded base64url");
    }
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      decoded[outputOffset] = (accumulator >>> availableBits) & 0xff;
      outputOffset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }

  if (outputOffset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new TypeError("public key must decode to exactly 32 canonical bytes");
  }
  return decoded;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function assertDigestBytes(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) {
    throw new TypeError("SHA-256 host result must be exactly 32 bytes");
  }
  return value.slice();
}

function bytesToLowerHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

/**
 * Hashes only the decoded canonical raw 32-byte Ed25519 public key. This
 * primitive deliberately has no JCS/domain wrapper and never constructs SPKI.
 */
export async function deriveEd25519PublicKeyDigestV1(
  publicKeyBytes: unknown,
  cryptoHost: ProviderCryptoHostV1,
): Promise<Ed25519PublicKeyDigestV1> {
  const canonicalPublicKey =
    CanonicalPublicKeyBytes32V1Schema.parse(publicKeyBytes);
  const rawPublicKey = decodeCanonicalPublicKeyBytes32V1(canonicalPublicKey);
  const hostInput = rawPublicKey.slice();
  const hostResult = await cryptoHost.sha256(hostInput);
  if (!equalBytes(hostInput, rawPublicKey)) {
    throw new TypeError("SHA-256 host must not mutate its input");
  }
  const digestBytes = assertDigestBytes(hostResult);
  return Ed25519PublicKeyDigestV1Schema.parse(
    `sha256:${bytesToLowerHex(digestBytes)}`,
  );
}

export async function verifyProviderEd25519PublicKeyDigestGoldenManifestV1(
  input: unknown,
  cryptoHost: ProviderCryptoHostV1,
): Promise<ProviderEd25519PublicKeyDigestGoldenManifestV1> {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const manifest =
    ProviderEd25519PublicKeyDigestGoldenManifestV1Schema.parse(input);
  const vector = manifest.cases[0]!;
  const rawPublicKey = decodeCanonicalPublicKeyBytes32V1(
    vector.publicKeyBytes,
  );
  if (bytesToLowerHex(rawPublicKey) !== vector.rawPublicKeyHex) {
    throw new TypeError("raw public-key golden bytes mismatch");
  }

  const publicKeyDigest = await deriveEd25519PublicKeyDigestV1(
    vector.publicKeyBytes,
    cryptoHost,
  );
  if (publicKeyDigest !== vector.expectedPublicKeyDigest) {
    throw new TypeError("raw public-key digest golden mismatch");
  }

  const legacyRootKeyId = await deriveProviderRegistryRootKeyIdV1(
    { publicKeyBytes: vector.publicKeyBytes },
    cryptoHost,
  );
  if (
    legacyRootKeyId !==
    vector.expectedLegacyProviderRegistryRootKeyId
  ) {
    throw new TypeError("legacy root key-ID golden mismatch");
  }
  return manifest;
}
