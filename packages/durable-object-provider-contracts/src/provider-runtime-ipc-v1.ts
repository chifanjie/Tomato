import { z } from "./zod-runtime.js";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  LowerHex32V1Schema,
  LowerHex64V1Schema,
} from "./primitives.js";

export const PROVIDER_RUNTIME_IPC_PROTOCOL_V1 =
  "understand_code_durable_provider_ipc_v1" as const;
export const PROVIDER_RUNTIME_IPC_AUTH_DOMAIN_V1 =
  "understand-code-durable-provider-runtime-ipc-auth-v1" as const;
export const PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1 = 8 * 1024 * 1024;
export const PROVIDER_RUNTIME_IPC_SOCKET_MODE_V1 = 0o600;
export const PROVIDER_RUNTIME_IPC_STORAGE_DIRECTORY_MODE_V1 = 0o700;
export const PROVIDER_RUNTIME_IPC_STORAGE_FILE_MODE_V1 = 0o600;

const ProviderRuntimeIpcProtocolV1Schema = z.literal(
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
);
const ProviderRuntimeIpcAuthTagV1Schema = z
  .string()
  .regex(/^hmac-sha256:[0-9a-f]{64}$/u);
const ProviderRuntimeIpcNonceV1Schema = LowerHex64V1Schema;
const NonnegativeSafeIntegerV1Schema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

export type ProviderRuntimeIpcJsonValueV1 =
  | null
  | boolean
  | number
  | string
  | readonly ProviderRuntimeIpcJsonValueV1[]
  | { readonly [key: string]: ProviderRuntimeIpcJsonValueV1 };

const ProviderRuntimeIpcJsonValueV1Schema: z.ZodType<ProviderRuntimeIpcJsonValueV1> =
  z.lazy(() =>
    z.union([
      z.null(),
      z.boolean(),
      z.number().finite().safe(),
      z.string(),
      z.array(ProviderRuntimeIpcJsonValueV1Schema),
      z.record(z.string(), ProviderRuntimeIpcJsonValueV1Schema),
    ]),
  );

export const ProviderRuntimeIpcFixedObjectLocatorV1Schema = z.strictObject({
  providerId: DurableObjectIdentityProviderIdV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderRuntimeIpcFixedObjectLocatorV1 = z.infer<
  typeof ProviderRuntimeIpcFixedObjectLocatorV1Schema
>;

export const ProviderRuntimeIpcClientHelloV1Schema = z.strictObject({
  protocol: ProviderRuntimeIpcProtocolV1Schema,
  kind: z.literal("client_hello"),
  clientNonce: ProviderRuntimeIpcNonceV1Schema,
  capabilityDigest: ContentDigestV1Schema,
  authTag: ProviderRuntimeIpcAuthTagV1Schema,
});
export type ProviderRuntimeIpcClientHelloV1 = z.infer<
  typeof ProviderRuntimeIpcClientHelloV1Schema
>;

export const ProviderRuntimeIpcServerHelloV1Schema = z.strictObject({
  protocol: ProviderRuntimeIpcProtocolV1Schema,
  kind: z.literal("server_hello"),
  clientNonce: ProviderRuntimeIpcNonceV1Schema,
  serverNonce: ProviderRuntimeIpcNonceV1Schema,
  sessionId: LowerHex32V1Schema,
  authTag: ProviderRuntimeIpcAuthTagV1Schema,
});
export type ProviderRuntimeIpcServerHelloV1 = z.infer<
  typeof ProviderRuntimeIpcServerHelloV1Schema
>;

const ProviderRuntimeIpcRequestCommonShapeV1 = {
  protocol: ProviderRuntimeIpcProtocolV1Schema,
  kind: z.literal("request"),
  sessionId: LowerHex32V1Schema,
  requestId: LowerHex32V1Schema,
  sequence: PositiveSafeIntegerV1Schema,
  capabilityDigest: ContentDigestV1Schema,
  authTag: ProviderRuntimeIpcAuthTagV1Schema,
} as const;

export const ProviderRuntimeIpcInspectStateRequestV1Schema = z.strictObject({
  ...ProviderRuntimeIpcRequestCommonShapeV1,
  operation: z.literal("inspect_state"),
  payload: z.strictObject({}),
});
export const ProviderRuntimeIpcReadObjectRequestV1Schema = z.strictObject({
  ...ProviderRuntimeIpcRequestCommonShapeV1,
  operation: z.literal("read_object"),
  payload: z.strictObject({
    locator: ProviderRuntimeIpcFixedObjectLocatorV1Schema,
  }),
});
export const ProviderRuntimeIpcWriteObjectRequestV1Schema = z.strictObject({
  ...ProviderRuntimeIpcRequestCommonShapeV1,
  operation: z.literal("write_object"),
  payload: z.strictObject({
    locator: ProviderRuntimeIpcFixedObjectLocatorV1Schema,
    logicalBytes: NonnegativeSafeIntegerV1Schema,
    bytes: CanonicalByteStringV1Schema,
  }),
});
export const ProviderRuntimeIpcCompareCommitRequestV1Schema = z.strictObject({
  ...ProviderRuntimeIpcRequestCommonShapeV1,
  operation: z.literal("compare_commit"),
  payload: z.strictObject({
    expectedRevision: NonnegativeSafeIntegerV1Schema,
    operationNonce: LowerHex32V1Schema,
    phase: z.string().min(1).max(128),
    artifacts: z.record(z.string().min(1).max(256), ProviderRuntimeIpcJsonValueV1Schema),
  }),
});

export const ProviderRuntimeIpcRequestV1Schema = z.discriminatedUnion(
  "operation",
  [
    ProviderRuntimeIpcInspectStateRequestV1Schema,
    ProviderRuntimeIpcReadObjectRequestV1Schema,
    ProviderRuntimeIpcWriteObjectRequestV1Schema,
    ProviderRuntimeIpcCompareCommitRequestV1Schema,
  ],
);
export type ProviderRuntimeIpcRequestV1 = z.infer<
  typeof ProviderRuntimeIpcRequestV1Schema
>;
export type ProviderRuntimeIpcOperationV1 =
  ProviderRuntimeIpcRequestV1["operation"];

export const ProviderRuntimeIpcJournalStateV1Schema = z.strictObject({
  profile: z.literal("provider_runtime_durable_journal_state_v1"),
  revision: NonnegativeSafeIntegerV1Schema,
  phase: z.string().min(1).max(128),
  operationNonce: z.union([LowerHex32V1Schema, z.literal("none")]),
  mutationDigest: z.union([ContentDigestV1Schema, z.literal("none")]),
  artifacts: z.record(z.string().min(1).max(256), ProviderRuntimeIpcJsonValueV1Schema),
});
export type ProviderRuntimeIpcJournalStateV1 = z.infer<
  typeof ProviderRuntimeIpcJournalStateV1Schema
>;

export const ProviderRuntimeIpcInspectStateResultV1Schema = z.strictObject({
  operation: z.literal("inspect_state"),
  state: ProviderRuntimeIpcJournalStateV1Schema,
});
export type ProviderRuntimeIpcInspectStateResultV1 = z.infer<
  typeof ProviderRuntimeIpcInspectStateResultV1Schema
>;
export const ProviderRuntimeIpcReadObjectResultV1Schema = z.strictObject({
  operation: z.literal("read_object"),
  locator: ProviderRuntimeIpcFixedObjectLocatorV1Schema,
  logicalBytes: NonnegativeSafeIntegerV1Schema,
  bytes: CanonicalByteStringV1Schema,
  verifiedContentDigest: ContentDigestV1Schema,
});
export type ProviderRuntimeIpcReadObjectResultV1 = z.infer<
  typeof ProviderRuntimeIpcReadObjectResultV1Schema
>;
export const ProviderRuntimeIpcWriteObjectResultV1Schema = z.strictObject({
  operation: z.literal("write_object"),
  resolution: z.enum(["committed", "replayed"]),
  locator: ProviderRuntimeIpcFixedObjectLocatorV1Schema,
  logicalBytes: NonnegativeSafeIntegerV1Schema,
  verifiedContentDigest: ContentDigestV1Schema,
});
export type ProviderRuntimeIpcWriteObjectResultV1 = z.infer<
  typeof ProviderRuntimeIpcWriteObjectResultV1Schema
>;
export const ProviderRuntimeIpcCompareCommitResultV1Schema = z.strictObject({
  operation: z.literal("compare_commit"),
  resolution: z.enum(["committed", "replayed", "stale"]),
  state: ProviderRuntimeIpcJournalStateV1Schema,
});
export type ProviderRuntimeIpcCompareCommitResultV1 = z.infer<
  typeof ProviderRuntimeIpcCompareCommitResultV1Schema
>;
export const ProviderRuntimeIpcSuccessPayloadV1Schema = z.discriminatedUnion(
  "operation",
  [
    ProviderRuntimeIpcInspectStateResultV1Schema,
    ProviderRuntimeIpcReadObjectResultV1Schema,
    ProviderRuntimeIpcWriteObjectResultV1Schema,
    ProviderRuntimeIpcCompareCommitResultV1Schema,
  ],
);
export type ProviderRuntimeIpcSuccessPayloadV1 = z.infer<
  typeof ProviderRuntimeIpcSuccessPayloadV1Schema
>;

const ProviderRuntimeIpcResponseCommonShapeV1 = {
  protocol: ProviderRuntimeIpcProtocolV1Schema,
  kind: z.literal("response"),
  sessionId: LowerHex32V1Schema,
  requestId: LowerHex32V1Schema,
  sequence: PositiveSafeIntegerV1Schema,
  authTag: ProviderRuntimeIpcAuthTagV1Schema,
} as const;
export const ProviderRuntimeIpcSuccessResponseV1Schema = z.strictObject({
  ...ProviderRuntimeIpcResponseCommonShapeV1,
  ok: z.literal(true),
  payload: ProviderRuntimeIpcSuccessPayloadV1Schema,
});
export const ProviderRuntimeIpcErrorResponseV1Schema = z.strictObject({
  ...ProviderRuntimeIpcResponseCommonShapeV1,
  ok: z.literal(false),
  error: z.strictObject({
    code: z.enum([
      "authentication_failed",
      "capability_mismatch",
      "frame_invalid",
      "object_not_found",
      "object_digest_mismatch",
      "object_length_mismatch",
      "operation_nonce_conflict",
      "storage_failure",
      "unsupported_operation",
    ]),
    message: z.string().min(1).max(1024),
  }),
});
export const ProviderRuntimeIpcResponseV1Schema = z.discriminatedUnion("ok", [
  ProviderRuntimeIpcSuccessResponseV1Schema,
  ProviderRuntimeIpcErrorResponseV1Schema,
]);
export type ProviderRuntimeIpcResponseV1 = z.infer<
  typeof ProviderRuntimeIpcResponseV1Schema
>;

type ProviderRuntimeIpcAuthenticatedWireV1 =
  | ProviderRuntimeIpcClientHelloV1
  | ProviderRuntimeIpcServerHelloV1
  | ProviderRuntimeIpcRequestV1
  | ProviderRuntimeIpcResponseV1;

/** Canonical bytes authenticated by HMAC; the authTag never authenticates itself. */
export function canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1(
  wire: ProviderRuntimeIpcAuthenticatedWireV1,
): Uint8Array {
  const { authTag: _authTag, ...claims } = wire;
  return canonicalizeJcsSafeIntegerUtf8V1({
    domain: PROVIDER_RUNTIME_IPC_AUTH_DOMAIN_V1,
    claims,
  });
}
