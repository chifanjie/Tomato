import { sha256InternalV1 } from "./sha256.js";

const objectGetPrototypeOfV1 = Object.getPrototypeOf;
const reflectApplyV1 = Reflect.apply;
const uint8ArrayConstructorV1 = Uint8Array;
const uint8ArrayPrototypeV1 = uint8ArrayConstructorV1.prototype;
const typedArrayPrototypeV1 = objectGetPrototypeOfV1(
  uint8ArrayPrototypeV1,
);
const typedArrayByteLengthGetterV1 = Object.getOwnPropertyDescriptor(
  typedArrayPrototypeV1,
  "byteLength",
)?.get;
const typedArrayBufferGetterV1 = Object.getOwnPropertyDescriptor(
  typedArrayPrototypeV1,
  "buffer",
)?.get;
const arrayBufferByteLengthGetterV1 = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)?.get;
const uint8ArraySetV1 = uint8ArrayPrototypeV1.set;
const textDecoderConstructorV1 = TextDecoder;
const textDecoderDecodeV1 = textDecoderConstructorV1.prototype.decode;
const jsonParseV1 = JSON.parse;

function isIntrinsicArrayBufferV1(value: unknown): boolean {
  if (arrayBufferByteLengthGetterV1 === undefined) return false;
  try {
    reflectApplyV1(arrayBufferByteLengthGetterV1, value, []);
    return true;
  } catch {
    return false;
  }
}

export function bytesToLowerHexInternalV1(
  bytes: Uint8Array,
): string {
  let output = "";
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, "0");
  }
  return output;
}

/**
 * Copies only a plain Uint8Array backed by an intrinsic ArrayBuffer. This is
 * package-private infrastructure for fixed signed-package resources.
 */
export function snapshotBoundedFixedResourceBytesInternalV1(
  input: unknown,
  maxBytes: number,
): Uint8Array {
  if (
    input === null ||
    typeof input !== "object" ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0 ||
    typedArrayByteLengthGetterV1 === undefined ||
    typedArrayBufferGetterV1 === undefined
  ) {
    throw new TypeError("invalid fixed resource bytes");
  }

  let byteLength: number;
  let backingBuffer: unknown;
  try {
    byteLength = reflectApplyV1(
      typedArrayByteLengthGetterV1,
      input,
      [],
    ) as number;
    backingBuffer = reflectApplyV1(
      typedArrayBufferGetterV1,
      input,
      [],
    );
  } catch {
    throw new TypeError("invalid fixed resource bytes");
  }

  if (
    objectGetPrototypeOfV1(input) !== uint8ArrayPrototypeV1 ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0 ||
    byteLength > maxBytes ||
    !isIntrinsicArrayBufferV1(backingBuffer)
  ) {
    throw new TypeError("invalid fixed resource bytes");
  }

  const snapshot = new uint8ArrayConstructorV1(byteLength);
  try {
    reflectApplyV1(uint8ArraySetV1, snapshot, [input]);
  } catch {
    throw new TypeError("invalid fixed resource bytes");
  }
  if (
    reflectApplyV1(
      typedArrayByteLengthGetterV1,
      snapshot,
      [],
    ) !== byteLength
  ) {
    throw new TypeError("invalid fixed resource bytes");
  }
  return snapshot;
}

export function assertFixedResourceByteAnchorInternalV1(
  bytes: Uint8Array,
  expectedByteLength: number,
  expectedSha256Hex: string,
): void {
  if (
    bytes.byteLength !== expectedByteLength ||
    bytesToLowerHexInternalV1(sha256InternalV1(bytes)) !==
      expectedSha256Hex
  ) {
    throw new TypeError("fixed resource byte anchor mismatch");
  }
}

export function parseFixedUtf8JsonResourceInternalV1(
  bytes: Uint8Array,
): unknown {
  let text: string;
  try {
    const decoder = new textDecoderConstructorV1("utf-8", {
      fatal: true,
    });
    text = reflectApplyV1(textDecoderDecodeV1, decoder, [
      bytes,
    ]) as string;
  } catch {
    throw new TypeError("fixed resource is not strict UTF-8");
  }

  try {
    return reflectApplyV1(jsonParseV1, JSON, [text]) as unknown;
  } catch {
    throw new TypeError("fixed resource is not JSON");
  }
}
