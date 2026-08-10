// SHA-256 is reached transitively by trust-boundary filename codecs. Capture
// every mutable intrinsic it needs while the module realm is bootstrapping so
// post-start replacement cannot alter a digest or turn a rejection into an
// acceptance.
const CapturedBigIntV1 = BigInt;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedFunctionPrototypeHasInstanceV1 =
  Function.prototype[Symbol.hasInstance];
const CapturedNumberV1 = Number;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedUint32ArrayV1 = Uint32Array;
const CapturedUint8ArrayPrototypeSetV1 = CapturedUint8ArrayV1.prototype.set;
const CapturedTypedArrayPrototypeV1 = CapturedObjectGetPrototypeOfV1(
  CapturedUint8ArrayV1.prototype,
);
const CapturedTypedArrayByteLengthGetterV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;

if (CapturedTypedArrayByteLengthGetterV1 === undefined) {
  throw new CapturedTypeErrorV1(
    "Uint8Array byteLength primordial unavailable",
  );
}

function bindUncurriedSha256IntrinsicV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const functionHasInstanceV1 = bindUncurriedSha256IntrinsicV1(
  CapturedFunctionPrototypeHasInstanceV1,
) as (receiver: Function, value: unknown) => boolean;
const typedArrayByteLengthV1 = bindUncurriedSha256IntrinsicV1(
  CapturedTypedArrayByteLengthGetterV1,
) as (receiver: Uint8Array | Uint32Array) => number;
const uint8ArraySetV1 = bindUncurriedSha256IntrinsicV1(
  CapturedUint8ArrayPrototypeSetV1,
) as (
  receiver: Uint8Array,
  source: ArrayLike<number>,
  offset?: number,
) => void;

const SHA256_INITIAL_STATE = CapturedObjectFreezeV1([
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
] as const);

const SHA256_ROUND_CONSTANTS = CapturedObjectFreezeV1([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const);

function rotateRight32(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function writeBigEndian32(
  output: Uint8Array,
  offset: number,
  value: number,
): void {
  output[offset] = value >>> 24;
  output[offset + 1] = value >>> 16;
  output[offset + 2] = value >>> 8;
  output[offset + 3] = value;
}

/**
 * Small browser/worker-portable SHA-256 used only to authenticate compiled
 * structural resources. It deliberately has no host callback that a caller can
 * substitute while minting an opaque trust capability.
 */
export function sha256InternalV1(message: Uint8Array): Uint8Array {
  if (!functionHasInstanceV1(CapturedUint8ArrayV1, message)) {
    throw new CapturedTypeErrorV1("SHA-256 message must be a Uint8Array");
  }

  const messageByteLength = typedArrayByteLengthV1(message);
  const remainder = (messageByteLength + 9) % 64;
  const paddedLength =
    messageByteLength + 9 + (remainder === 0 ? 0 : 64 - remainder);
  const padded = new CapturedUint8ArrayV1(paddedLength);
  uint8ArraySetV1(padded, message);
  padded[messageByteLength] = 0x80;

  let bitLength = CapturedBigIntV1(messageByteLength) * 8n;
  for (let index = 0; index < 8; index += 1) {
    padded[paddedLength - 1 - index] = CapturedNumberV1(
      bitLength & 0xffn,
    );
    bitLength >>= 8n;
  }

  let h0: number = SHA256_INITIAL_STATE[0];
  let h1: number = SHA256_INITIAL_STATE[1];
  let h2: number = SHA256_INITIAL_STATE[2];
  let h3: number = SHA256_INITIAL_STATE[3];
  let h4: number = SHA256_INITIAL_STATE[4];
  let h5: number = SHA256_INITIAL_STATE[5];
  let h6: number = SHA256_INITIAL_STATE[6];
  let h7: number = SHA256_INITIAL_STATE[7];
  const words = new CapturedUint32ArrayV1(64);

  for (
    let offset = 0;
    offset < typedArrayByteLengthV1(padded);
    offset += 64
  ) {
    for (let index = 0; index < 16; index += 1) {
      const wordOffset = offset + index * 4;
      words[index] =
        ((padded[wordOffset]! << 24) |
          (padded[wordOffset + 1]! << 16) |
          (padded[wordOffset + 2]! << 8) |
          padded[wordOffset + 3]!) >>>
        0;
    }
    for (let index = 16; index < 64; index += 1) {
      const word15 = words[index - 15]!;
      const word2 = words[index - 2]!;
      const sigma0 =
        rotateRight32(word15, 7) ^
        rotateRight32(word15, 18) ^
        (word15 >>> 3);
      const sigma1 =
        rotateRight32(word2, 17) ^
        rotateRight32(word2, 19) ^
        (word2 >>> 10);
      words[index] =
        (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const sum1 =
        rotateRight32(e, 6) ^ rotateRight32(e, 11) ^ rotateRight32(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 =
        (h +
          sum1 +
          choose +
          SHA256_ROUND_CONSTANTS[index]! +
          words[index]!) >>>
        0;
      const sum0 =
        rotateRight32(a, 2) ^ rotateRight32(a, 13) ^ rotateRight32(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const digest = new CapturedUint8ArrayV1(32);
  writeBigEndian32(digest, 0, h0);
  writeBigEndian32(digest, 4, h1);
  writeBigEndian32(digest, 8, h2);
  writeBigEndian32(digest, 12, h3);
  writeBigEndian32(digest, 16, h4);
  writeBigEndian32(digest, 20, h5);
  writeBigEndian32(digest, 24, h6);
  writeBigEndian32(digest, 28, h7);
  return digest;
}

CapturedObjectFreezeV1(sha256InternalV1);
