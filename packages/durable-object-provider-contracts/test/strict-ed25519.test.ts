import { describe, expect, it } from "vitest";

import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";

const SUBGROUP_ORDER =
  (1n << 252n) + 27742317777372353535851937790883648493n;

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/u.test(hex)) {
    throw new Error("invalid test hex");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function littleEndianToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let index = bytes.byteLength - 1; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(bytes[index]!);
  }
  return value;
}

function writeLittleEndian(value: bigint, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  let remaining = value;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  if (remaining !== 0n) throw new Error("test integer does not fit");
  return bytes;
}

const RFC8032_EMPTY = {
  publicKey: hexToBytes(
    "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  ),
  message: new Uint8Array(),
  signature: hexToBytes(
    "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
      "5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
  ),
};

const RFC8032_ONE_BYTE = {
  publicKey: hexToBytes(
    "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
  ),
  message: hexToBytes("72"),
  signature: hexToBytes(
    "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da" +
      "085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00",
  ),
};

const RFC8032_TWO_BYTE = {
  publicKey: hexToBytes(
    "fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025",
  ),
  message: hexToBytes("af82"),
  signature: hexToBytes(
    "6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac" +
      "18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a",
  ),
};

const RFC8032_SHA_ABC = {
  publicKey: hexToBytes(
    "ec172b93ad5e563bf4932c70e1245034c35467ef2efd4d64ebf819683467e2bf",
  ),
  message: hexToBytes(
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a" +
      "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
  ),
  signature: hexToBytes(
    "dc2a4459e7369633a52b1bf277839a00201009a3efbf3ecb69bea2186c26b589" +
      "09351fc9ac90b3ecfdfbc7c66431e0303dca179c138ac17ad9bef1177331a704",
  ),
};

describe("strict Ed25519 reference primitive", () => {
  it("freezes the project verification profile", () => {
    expect(STRICT_ED25519_VERIFICATION_PROFILE_V1).toBe(
      "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    );
  });

  it("freezes the reference functions and uses only bootstrap-captured primordials", () => {
    expect(Object.isFrozen(validatePrimeSubgroupPoint)).toBe(true);
    expect(Object.isFrozen(verifyRawEd25519)).toBe(true);

    const globalBigIntDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "BigInt",
    )!;
    const globalNumberDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "Number",
    )!;
    const globalUint8ArrayDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "Uint8Array",
    )!;
    const arrayFromDescriptor = Object.getOwnPropertyDescriptor(
      Array,
      "from",
    )!;
    const typedArrayPrototype = Object.getPrototypeOf(
      Uint8Array.prototype,
    ) as object;
    const typedArrayByteLengthDescriptor =
      Object.getOwnPropertyDescriptor(
        typedArrayPrototype,
        "byteLength",
      )!;
    const typedArraySetDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "set",
    )!;
    const poisonHits = {
      arrayFrom: 0,
      bigint: 0,
      number: 0,
      typedArrayByteLength: 0,
      typedArraySet: 0,
      uint8Array: 0,
    };
    let pointResult: boolean | undefined;
    let signatureResult: boolean | undefined;

    try {
      Object.defineProperty(globalThis, "BigInt", {
        configurable: globalBigIntDescriptor.configurable,
        enumerable: globalBigIntDescriptor.enumerable,
        get() {
          poisonHits.bigint += 1;
          return globalBigIntDescriptor.value;
        },
      });
      Object.defineProperty(globalThis, "Number", {
        configurable: globalNumberDescriptor.configurable,
        enumerable: globalNumberDescriptor.enumerable,
        get() {
          poisonHits.number += 1;
          return globalNumberDescriptor.value;
        },
      });
      Object.defineProperty(globalThis, "Uint8Array", {
        configurable: globalUint8ArrayDescriptor.configurable,
        enumerable: globalUint8ArrayDescriptor.enumerable,
        get() {
          poisonHits.uint8Array += 1;
          return globalUint8ArrayDescriptor.value;
        },
      });
      Object.defineProperty(Array, "from", {
        ...arrayFromDescriptor,
        value(this: unknown, ...args: unknown[]) {
          poisonHits.arrayFrom += 1;
          return Reflect.apply(arrayFromDescriptor.value, this, args);
        },
      });
      Object.defineProperty(typedArrayPrototype, "byteLength", {
        configurable: typedArrayByteLengthDescriptor.configurable,
        enumerable: typedArrayByteLengthDescriptor.enumerable,
        get(this: Uint8Array) {
          poisonHits.typedArrayByteLength += 1;
          return Reflect.apply(
            typedArrayByteLengthDescriptor.get!,
            this,
            [],
          ) as number;
        },
      });
      Object.defineProperty(typedArrayPrototype, "set", {
        ...typedArraySetDescriptor,
        value(
          this: Uint8Array,
          source: ArrayLike<number>,
          offset?: number,
        ) {
          poisonHits.typedArraySet += 1;
          return Reflect.apply(typedArraySetDescriptor.value, this, [
            source,
            offset,
          ]);
        },
      });

      pointResult = validatePrimeSubgroupPoint(RFC8032_EMPTY.publicKey);
      signatureResult = verifyRawEd25519(
        RFC8032_EMPTY.publicKey,
        RFC8032_EMPTY.message,
        RFC8032_EMPTY.signature,
      );
    } finally {
      Object.defineProperty(
        globalThis,
        "BigInt",
        globalBigIntDescriptor,
      );
      Object.defineProperty(
        globalThis,
        "Number",
        globalNumberDescriptor,
      );
      Object.defineProperty(
        globalThis,
        "Uint8Array",
        globalUint8ArrayDescriptor,
      );
      Object.defineProperty(Array, "from", arrayFromDescriptor);
      Object.defineProperty(
        typedArrayPrototype,
        "byteLength",
        typedArrayByteLengthDescriptor,
      );
      Object.defineProperty(
        typedArrayPrototype,
        "set",
        typedArraySetDescriptor,
      );
    }

    expect(pointResult).toBe(true);
    expect(signatureResult).toBe(true);
    expect(poisonHits).toEqual({
      arrayFrom: 0,
      bigint: 0,
      number: 0,
      typedArrayByteLength: 0,
      typedArraySet: 0,
      uint8Array: 0,
    });
  });

  it("accepts PureEd25519 RFC 8032 vectors with prime-subgroup A and R", () => {
    for (const vector of [
      RFC8032_EMPTY,
      RFC8032_ONE_BYTE,
      RFC8032_TWO_BYTE,
      RFC8032_SHA_ABC,
    ]) {
      expect(validatePrimeSubgroupPoint(vector.publicKey)).toBe(true);
      expect(validatePrimeSubgroupPoint(vector.signature.slice(0, 32))).toBe(
        true,
      );
      expect(
        verifyRawEd25519(vector.publicKey, vector.message, vector.signature),
      ).toBe(true);
    }
  });

  it("rejects wrong raw lengths before curve or equation processing", () => {
    expect(validatePrimeSubgroupPoint(new Uint8Array(31))).toBe(false);
    expect(validatePrimeSubgroupPoint(new Uint8Array(33))).toBe(false);
    expect(
      verifyRawEd25519(
        RFC8032_EMPTY.publicKey.slice(0, 31),
        RFC8032_EMPTY.message,
        RFC8032_EMPTY.signature,
      ),
    ).toBe(false);
    expect(
      verifyRawEd25519(
        RFC8032_EMPTY.publicKey,
        RFC8032_EMPTY.message,
        RFC8032_EMPTY.signature.slice(0, 63),
      ),
    ).toBe(false);
    expect(
      verifyRawEd25519(
        RFC8032_EMPTY.publicKey,
        RFC8032_EMPTY.message,
        new Uint8Array(65),
      ),
    ).toBe(false);
  });

  it("rejects non-canonical, negative-zero, identity, and torsion points", () => {
    const yEqualsP = hexToBytes(
      "edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
    );
    const negativeZero = hexToBytes(
      "0100000000000000000000000000000000000000000000000000000000000080",
    );
    const identity = hexToBytes(
      "0100000000000000000000000000000000000000000000000000000000000000",
    );
    const orderTwo = hexToBytes(
      "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
    );

    for (const point of [yEqualsP, negativeZero, identity, orderTwo]) {
      expect(validatePrimeSubgroupPoint(point)).toBe(false);
    }

    const identityForgery = new Uint8Array(64);
    identityForgery.set(identity, 0);
    expect(
      verifyRawEd25519(identity, hexToBytes("74657374"), identityForgery),
    ).toBe(false);

    for (const invalidR of [yEqualsP, negativeZero, identity, orderTwo]) {
      const signature = new Uint8Array(RFC8032_EMPTY.signature);
      signature.set(invalidR, 0);
      expect(
        verifyRawEd25519(
          RFC8032_EMPTY.publicKey,
          RFC8032_EMPTY.message,
          signature,
        ),
      ).toBe(false);
    }
  });

  it("rejects mixed-order public keys and mixed-order R points", () => {
    const mixedOrderPoint = hexToBytes(`95${"99".repeat(31)}`);
    const mixedOrderSignature = hexToBytes(
      `58${"66".repeat(31)}` +
        "05360ad4603f9a3389dcfdd5281bd39517150daff21f6cdc2eb4fc920d670d06",
    );
    expect(validatePrimeSubgroupPoint(mixedOrderPoint)).toBe(false);
    expect(
      verifyRawEd25519(
        mixedOrderPoint,
        hexToBytes("6d697865642d30"),
        mixedOrderSignature,
      ),
    ).toBe(false);

    const mixedOrderR = hexToBytes(
      "08a9bcff3c9f538d6f791d337f917d757b7880e1471a268b278c1f9addb6feaa",
    );
    expect(validatePrimeSubgroupPoint(mixedOrderR)).toBe(false);
    const mixedRSignature = new Uint8Array(RFC8032_EMPTY.signature);
    mixedRSignature.set(mixedOrderR, 0);
    expect(
      verifyRawEd25519(
        RFC8032_EMPTY.publicKey,
        RFC8032_EMPTY.message,
        mixedRSignature,
      ),
    ).toBe(false);
  });

  it("rejects S equal to L and S-plus-L malleability", () => {
    const sEqualsL = new Uint8Array(RFC8032_EMPTY.signature);
    sEqualsL.set(writeLittleEndian(SUBGROUP_ORDER, 32), 32);
    expect(
      verifyRawEd25519(
        RFC8032_EMPTY.publicKey,
        RFC8032_EMPTY.message,
        sEqualsL,
      ),
    ).toBe(false);

    const originalS = littleEndianToBigInt(
      RFC8032_EMPTY.signature.slice(32, 64),
    );
    const sPlusL = new Uint8Array(RFC8032_EMPTY.signature);
    sPlusL.set(writeLittleEndian(originalS + SUBGROUP_ORDER, 32), 32);
    expect(
      verifyRawEd25519(
        RFC8032_EMPTY.publicKey,
        RFC8032_EMPTY.message,
        sPlusL,
      ),
    ).toBe(false);
  });

  it("uses the exact PureEd25519 message and cofactorless equation", () => {
    const changedMessage = hexToBytes("00");
    expect(
      verifyRawEd25519(
        RFC8032_EMPTY.publicKey,
        changedMessage,
        RFC8032_EMPTY.signature,
      ),
    ).toBe(false);

    const changedR = new Uint8Array(RFC8032_EMPTY.signature);
    changedR[0] = changedR[0]! ^ 1;
    expect(
      verifyRawEd25519(
        RFC8032_EMPTY.publicKey,
        RFC8032_EMPTY.message,
        changedR,
      ),
    ).toBe(false);
  });

  it("never mutates caller-owned key, message, or signature buffers", () => {
    const publicKey = new Uint8Array(RFC8032_ONE_BYTE.publicKey);
    const message = new Uint8Array(RFC8032_ONE_BYTE.message);
    const signature = new Uint8Array(RFC8032_ONE_BYTE.signature);
    const publicKeyBefore = new Uint8Array(publicKey);
    const messageBefore = new Uint8Array(message);
    const signatureBefore = new Uint8Array(signature);

    expect(validatePrimeSubgroupPoint(publicKey)).toBe(true);
    expect(verifyRawEd25519(publicKey, message, signature)).toBe(true);
    expect(publicKey).toEqual(publicKeyBefore);
    expect(message).toEqual(messageBefore);
    expect(signature).toEqual(signatureBefore);
  });
});
