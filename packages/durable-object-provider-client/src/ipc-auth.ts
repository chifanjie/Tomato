import { createHmac, timingSafeEqual } from "node:crypto";

import {
  PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1,
  canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1,
  type ProviderRuntimeIpcClientHelloV1,
  type ProviderRuntimeIpcRequestV1,
  type ProviderRuntimeIpcResponseV1,
  type ProviderRuntimeIpcServerHelloV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";

type AuthenticatedWireV1 =
  | ProviderRuntimeIpcClientHelloV1
  | ProviderRuntimeIpcServerHelloV1
  | ProviderRuntimeIpcRequestV1
  | ProviderRuntimeIpcResponseV1;
const ZERO_AUTH_TAG_V1 = `hmac-sha256:${"0".repeat(64)}`;

export function signProviderRuntimeIpcWireV1<T extends object>(
  sharedSecret: Uint8Array,
  unsignedWire: T,
): T & { readonly authTag: string } {
  const wireWithPlaceholder = {
    ...unsignedWire,
    authTag: ZERO_AUTH_TAG_V1,
  } as unknown as AuthenticatedWireV1;
  const digest = createHmac("sha256", sharedSecret)
    .update(canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1(wireWithPlaceholder))
    .digest("hex");
  return { ...unsignedWire, authTag: `hmac-sha256:${digest}` };
}

export function verifyProviderRuntimeIpcWireAuthV1(
  sharedSecret: Uint8Array,
  wire: AuthenticatedWireV1,
): boolean {
  const { authTag: _authTag, ...unsignedWire } = wire;
  const expected = signProviderRuntimeIpcWireV1(sharedSecret, unsignedWire)
    .authTag;
  const expectedBytes = Buffer.from(expected, "utf8");
  const observedBytes = Buffer.from(wire.authTag, "utf8");
  return (
    expectedBytes.byteLength === observedBytes.byteLength &&
    timingSafeEqual(expectedBytes, observedBytes)
  );
}

export function encodeProviderRuntimeIpcFrameV1(value: unknown): string {
  const frame = `${JSON.stringify(value)}\n`;
  if (Buffer.byteLength(frame, "utf8") > PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1) {
    throw new RangeError("provider runtime IPC frame exceeds the frozen limit");
  }
  return frame;
}

export function assertProviderRuntimeIpcFrameSizeV1(frame: string): void {
  if (Buffer.byteLength(frame, "utf8") > PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1) {
    throw new RangeError("provider runtime IPC frame exceeds the frozen limit");
  }
}
