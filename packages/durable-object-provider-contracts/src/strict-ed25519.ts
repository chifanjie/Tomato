export const STRICT_ED25519_VERIFICATION_PROFILE_V1 =
  "ed25519-rfc8032-cofactorless-prime-subgroup-v1" as const;

const FIELD_PRIME = (1n << 255n) - 19n;
const SUBGROUP_ORDER =
  (1n << 252n) + 27742317777372353535851937790883648493n;
const CURVE_D =
  37095705934669439343138083508754565189542113879843219016388785533085940283555n;
const SQRT_MINUS_ONE =
  19681161376707505956807079304988542015446066515923890162744021073123829784752n;

const BASE_POINT_X =
  15112221349535400772501151409588531511454012693041857206046113283949847762202n;
const BASE_POINT_Y =
  46316835694926478169428394003475163141307993866256225615783033603165251855960n;

const MASK_64 = (1n << 64n) - 1n;
const SHA512_INITIAL_STATE = [
  0x6a09e667f3bcc908n,
  0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn,
  0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n,
  0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn,
  0x5be0cd19137e2179n,
] as const;

const SHA512_ROUND_CONSTANTS = [
  0x428a2f98d728ae22n,
  0x7137449123ef65cdn,
  0xb5c0fbcfec4d3b2fn,
  0xe9b5dba58189dbbcn,
  0x3956c25bf348b538n,
  0x59f111f1b605d019n,
  0x923f82a4af194f9bn,
  0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n,
  0x12835b0145706fben,
  0x243185be4ee4b28cn,
  0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn,
  0x80deb1fe3b1696b1n,
  0x9bdc06a725c71235n,
  0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n,
  0xefbe4786384f25e3n,
  0x0fc19dc68b8cd5b5n,
  0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n,
  0x4a7484aa6ea6e483n,
  0x5cb0a9dcbd41fbd4n,
  0x76f988da831153b5n,
  0x983e5152ee66dfabn,
  0xa831c66d2db43210n,
  0xb00327c898fb213fn,
  0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n,
  0xd5a79147930aa725n,
  0x06ca6351e003826fn,
  0x142929670a0e6e70n,
  0x27b70a8546d22ffcn,
  0x2e1b21385c26c926n,
  0x4d2c6dfc5ac42aedn,
  0x53380d139d95b3dfn,
  0x650a73548baf63den,
  0x766a0abb3c77b2a8n,
  0x81c2c92e47edaee6n,
  0x92722c851482353bn,
  0xa2bfe8a14cf10364n,
  0xa81a664bbc423001n,
  0xc24b8b70d0f89791n,
  0xc76c51a30654be30n,
  0xd192e819d6ef5218n,
  0xd69906245565a910n,
  0xf40e35855771202an,
  0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n,
  0x1e376c085141ab53n,
  0x2748774cdf8eeb99n,
  0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n,
  0x4ed8aa4ae3418acbn,
  0x5b9cca4f7763e373n,
  0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn,
  0x78a5636f43172f60n,
  0x84c87814a1f0ab72n,
  0x8cc702081a6439ecn,
  0x90befffa23631e28n,
  0xa4506cebde82bde9n,
  0xbef9a3f7b2c67915n,
  0xc67178f2e372532bn,
  0xca273eceea26619cn,
  0xd186b8c721c0c207n,
  0xeada7dd6cde0eb1en,
  0xf57d4f7fee6ed178n,
  0x06f067aa72176fban,
  0x0a637dc5a2c898a6n,
  0x113f9804bef90daen,
  0x1b710b35131c471bn,
  0x28db77f523047d84n,
  0x32caab7b40c72493n,
  0x3c9ebe0a15c9bebcn,
  0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n,
  0x597f299cfc657e2an,
  0x5fcb6fab3ad6faecn,
  0x6c44198c4a475817n,
] as const;

interface ExtendedPoint {
  readonly x: bigint;
  readonly y: bigint;
  readonly z: bigint;
  readonly t: bigint;
}

const IDENTITY: ExtendedPoint = { x: 0n, y: 1n, z: 1n, t: 0n };
const BASE_POINT: ExtendedPoint = {
  x: BASE_POINT_X,
  y: BASE_POINT_Y,
  z: 1n,
  t: (BASE_POINT_X * BASE_POINT_Y) % FIELD_PRIME,
};

function mod(value: bigint): bigint {
  const reduced = value % FIELD_PRIME;
  return reduced < 0n ? reduced + FIELD_PRIME : reduced;
}

function powMod(base: bigint, exponent: bigint): bigint {
  let result = 1n;
  let factor = mod(base);
  let remaining = exponent;
  while (remaining > 0n) {
    if ((remaining & 1n) === 1n) result = mod(result * factor);
    factor = mod(factor * factor);
    remaining >>= 1n;
  }
  return result;
}

function invert(value: bigint): bigint | undefined {
  const reduced = mod(value);
  if (reduced === 0n) return undefined;
  return powMod(reduced, FIELD_PRIME - 2n);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function littleEndianToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let index = bytes.byteLength - 1; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(bytes[index]!);
  }
  return value;
}

function encodePoint(point: ExtendedPoint): Uint8Array | undefined {
  const inverseZ = invert(point.z);
  if (inverseZ === undefined) return undefined;
  const affineX = mod(point.x * inverseZ);
  let affineY = mod(point.y * inverseZ);
  const encoded = new Uint8Array(32);
  for (let index = 0; index < encoded.byteLength; index += 1) {
    encoded[index] = Number(affineY & 0xffn);
    affineY >>= 8n;
  }
  encoded[31] = encoded[31]! | Number((affineX & 1n) << 7n);
  return encoded;
}

function decodePoint(encoded: Uint8Array): ExtendedPoint | undefined {
  if (encoded.byteLength !== 32) return undefined;

  const sign = encoded[31]! >>> 7;
  const yBytes = new Uint8Array(encoded);
  yBytes[31] = yBytes[31]! & 0x7f;
  const y = littleEndianToBigInt(yBytes);
  if (y >= FIELD_PRIME) return undefined;

  const ySquared = mod(y * y);
  const denominator = mod(CURVE_D * ySquared + 1n);
  const inverseDenominator = invert(denominator);
  if (inverseDenominator === undefined) return undefined;
  const xSquared = mod((ySquared - 1n) * inverseDenominator);

  let x = powMod(xSquared, (FIELD_PRIME + 3n) >> 3n);
  if (mod(x * x - xSquared) !== 0n) x = mod(x * SQRT_MINUS_ONE);
  if (mod(x * x - xSquared) !== 0n) return undefined;
  if (Number(x & 1n) !== sign) x = mod(FIELD_PRIME - x);
  if (x === 0n && sign === 1) return undefined;

  if (mod(ySquared - x * x - 1n - CURVE_D * x * x * ySquared) !== 0n) {
    return undefined;
  }

  const point: ExtendedPoint = {
    x,
    y,
    z: 1n,
    t: mod(x * y),
  };
  const reencoded = encodePoint(point);
  if (reencoded === undefined || !bytesEqual(reencoded, encoded)) {
    return undefined;
  }
  return point;
}

function addPoints(left: ExtendedPoint, right: ExtendedPoint): ExtendedPoint {
  const a = mod((left.y - left.x) * (right.y - right.x));
  const b = mod((left.y + left.x) * (right.y + right.x));
  const c = mod(2n * CURVE_D * left.t * right.t);
  const d = mod(2n * left.z * right.z);
  const e = mod(b - a);
  const f = mod(d - c);
  const g = mod(d + c);
  const h = mod(b + a);
  return {
    x: mod(e * f),
    y: mod(g * h),
    z: mod(f * g),
    t: mod(e * h),
  };
}

function doublePoint(point: ExtendedPoint): ExtendedPoint {
  const a = mod(point.x * point.x);
  const b = mod(point.y * point.y);
  const c = mod(2n * point.z * point.z);
  const d = mod(-a);
  const e = mod((point.x + point.y) * (point.x + point.y) - a - b);
  const g = mod(d + b);
  const f = mod(g - c);
  const h = mod(d - b);
  return {
    x: mod(e * f),
    y: mod(g * h),
    z: mod(f * g),
    t: mod(e * h),
  };
}

function multiplyPoint(point: ExtendedPoint, scalar: bigint): ExtendedPoint {
  let result = IDENTITY;
  let addend = point;
  let remaining = scalar;
  while (remaining > 0n) {
    if ((remaining & 1n) === 1n) result = addPoints(result, addend);
    addend = doublePoint(addend);
    remaining >>= 1n;
  }
  return result;
}

function pointsEqual(left: ExtendedPoint, right: ExtendedPoint): boolean {
  return (
    mod(left.x * right.z - right.x * left.z) === 0n &&
    mod(left.y * right.z - right.y * left.z) === 0n
  );
}

function isIdentity(point: ExtendedPoint): boolean {
  return pointsEqual(point, IDENTITY);
}

function isAdmissiblePoint(point: ExtendedPoint): boolean {
  if (isIdentity(point)) return false;
  // SUBGROUP_ORDER is intentionally not reduced before scalar multiplication.
  return isIdentity(multiplyPoint(point, SUBGROUP_ORDER));
}

function rotateRight64(value: bigint, amount: number): bigint {
  const shift = BigInt(amount);
  return ((value >> shift) | (value << (64n - shift))) & MASK_64;
}

function readBigEndian64(bytes: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let index = 0; index < 8; index += 1) {
    value = (value << 8n) | BigInt(bytes[offset + index]!);
  }
  return value;
}

function writeBigEndian64(bytes: Uint8Array, offset: number, value: bigint): void {
  let remaining = value;
  for (let index = 7; index >= 0; index -= 1) {
    bytes[offset + index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
}

function sha512(message: Uint8Array): Uint8Array {
  const remainder = (message.byteLength + 17) % 128;
  const paddedLength =
    message.byteLength + 17 + (remainder === 0 ? 0 : 128 - remainder);
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.byteLength] = 0x80;

  let bitLength = BigInt(message.byteLength) * 8n;
  for (let index = 0; index < 16; index += 1) {
    padded[paddedLength - 1 - index] = Number(bitLength & 0xffn);
    bitLength >>= 8n;
  }

  let h0: bigint = SHA512_INITIAL_STATE[0];
  let h1: bigint = SHA512_INITIAL_STATE[1];
  let h2: bigint = SHA512_INITIAL_STATE[2];
  let h3: bigint = SHA512_INITIAL_STATE[3];
  let h4: bigint = SHA512_INITIAL_STATE[4];
  let h5: bigint = SHA512_INITIAL_STATE[5];
  let h6: bigint = SHA512_INITIAL_STATE[6];
  let h7: bigint = SHA512_INITIAL_STATE[7];
  const words: bigint[] = Array.from({ length: 80 }, () => 0n);

  for (let offset = 0; offset < padded.byteLength; offset += 128) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = readBigEndian64(padded, offset + index * 8);
    }
    for (let index = 16; index < 80; index += 1) {
      const word15 = words[index - 15]!;
      const word2 = words[index - 2]!;
      const sigma0 =
        rotateRight64(word15, 1) ^
        rotateRight64(word15, 8) ^
        (word15 >> 7n);
      const sigma1 =
        rotateRight64(word2, 19) ^
        rotateRight64(word2, 61) ^
        (word2 >> 6n);
      words[index] =
        (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) &
        MASK_64;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 80; index += 1) {
      const sum1 =
        rotateRight64(e, 14) ^
        rotateRight64(e, 18) ^
        rotateRight64(e, 41);
      const choose = (e & f) ^ ((~e & MASK_64) & g);
      const temporary1 =
        (h + sum1 + choose + SHA512_ROUND_CONSTANTS[index]! + words[index]!) &
        MASK_64;
      const sum0 =
        rotateRight64(a, 28) ^
        rotateRight64(a, 34) ^
        rotateRight64(a, 39);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) & MASK_64;

      h = g;
      g = f;
      f = e;
      e = (d + temporary1) & MASK_64;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) & MASK_64;
    }

    h0 = (h0 + a) & MASK_64;
    h1 = (h1 + b) & MASK_64;
    h2 = (h2 + c) & MASK_64;
    h3 = (h3 + d) & MASK_64;
    h4 = (h4 + e) & MASK_64;
    h5 = (h5 + f) & MASK_64;
    h6 = (h6 + g) & MASK_64;
    h7 = (h7 + h) & MASK_64;
  }

  const digest = new Uint8Array(64);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((word, index) => {
    writeBigEndian64(digest, index * 8, word);
  });
  return digest;
}

function copyBytes(value: Uint8Array): Uint8Array | undefined {
  if (!(value instanceof Uint8Array)) return undefined;
  try {
    return new Uint8Array(value);
  } catch {
    return undefined;
  }
}

export function validatePrimeSubgroupPoint(encodedPoint: Uint8Array): boolean {
  const pointBytes = copyBytes(encodedPoint);
  if (pointBytes === undefined || pointBytes.byteLength !== 32) return false;
  const point = decodePoint(pointBytes);
  return point !== undefined && isAdmissiblePoint(point);
}

export function verifyRawEd25519(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  if (
    !(publicKey instanceof Uint8Array) ||
    publicKey.byteLength !== 32 ||
    !(signature instanceof Uint8Array) ||
    signature.byteLength !== 64 ||
    !(message instanceof Uint8Array)
  ) {
    return false;
  }

  const publicKeyBytes = copyBytes(publicKey);
  const signatureBytes = copyBytes(signature);
  const messageBytes = copyBytes(message);
  if (
    publicKeyBytes === undefined ||
    messageBytes === undefined ||
    signatureBytes === undefined
  ) {
    return false;
  }

  try {
    const encodedR = signatureBytes.slice(0, 32);
    const encodedS = signatureBytes.slice(32, 64);
    const publicPoint = decodePoint(publicKeyBytes);
    const signaturePoint = decodePoint(encodedR);
    if (
      publicPoint === undefined ||
      signaturePoint === undefined ||
      !isAdmissiblePoint(publicPoint) ||
      !isAdmissiblePoint(signaturePoint)
    ) {
      return false;
    }

    const scalarS = littleEndianToBigInt(encodedS);
    if (scalarS >= SUBGROUP_ORDER) return false;

    const hashInput = new Uint8Array(64 + messageBytes.byteLength);
    hashInput.set(encodedR, 0);
    hashInput.set(publicKeyBytes, 32);
    hashInput.set(messageBytes, 64);
    const challenge = littleEndianToBigInt(sha512(hashInput)) % SUBGROUP_ORDER;

    const left = multiplyPoint(BASE_POINT, scalarS);
    const right = addPoints(
      signaturePoint,
      multiplyPoint(publicPoint, challenge),
    );
    return pointsEqual(left, right);
  } catch {
    return false;
  }
}
