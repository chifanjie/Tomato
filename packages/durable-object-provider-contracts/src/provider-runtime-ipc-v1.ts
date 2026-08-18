import { z } from "./zod-runtime.js";

import { createDomainPreimageBytesV1 } from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  LowerHex32V1Schema,
  LowerHex64V1Schema,
  ProviderAcceptanceStateGenerationIdV1Schema,
  ProviderTargetProfileIdV1Schema,
  StoreProviderVerificationKeyIdV1Schema,
} from "./primitives.js";
import { ProviderRegistryManifestPinV1Schema } from "./provider-registry-records.js";
import { sha256InternalV1 } from "./sha256.js";

export const PROVIDER_RUNTIME_IPC_PROTOCOL_V1 =
  "understand_code_durable_provider_ipc_v1" as const;
export const PROVIDER_RUNTIME_IPC_AUTH_DOMAIN_V1 =
  "understand-code-durable-provider-runtime-ipc-auth-v1" as const;
export const PROVIDER_RUNTIME_IPC_PRINCIPAL_ATTESTATION_DOMAIN_V1 =
  "understand-code-durable-provider-runtime-principal-attestation-v1" as const;
export const PROVIDER_RUNTIME_IPC_PRINCIPAL_ATTESTATION_TRANSCRIPT_DOMAIN_V1 =
  "understand-code-durable-provider-runtime-principal-attestation-transcript-v1" as const;
export const PROVIDER_RUNTIME_IPC_STRONG_MUTATION_REQUEST_DOMAIN_V1 =
  "understand-code-durable-provider-runtime-strong-mutation-request-v1" as const;
export const PROVIDER_RUNTIME_IPC_STRONG_MUTATION_AUTHORITY_GRANT_ID_DOMAIN_V1 =
  "understand-code-durable-provider-runtime-strong-mutation-authority-grant-id-v1" as const;
export const PROVIDER_RUNTIME_IPC_STRONG_MUTATION_AUTHORITY_GRANT_SIGNATURE_DOMAIN_V1 =
  "understand-code-durable-provider-runtime-strong-mutation-authority-grant-signature-v1" as const;
export const PROVIDER_RUNTIME_IPC_STRONG_MUTATION_AUTHORITY_GRANT_DOMAIN_V1 =
  "understand-code-durable-provider-runtime-strong-mutation-authority-grant-v1" as const;
export const PROVIDER_RUNTIME_IPC_STRONG_MUTATION_SESSION_BINDING_DOMAIN_V1 =
  "understand-code-durable-provider-runtime-strong-mutation-session-binding-v1" as const;
export const PROVIDER_RUNTIME_IPC_STRONG_MUTATION_RESPONSE_DOMAIN_V1 =
  "understand-code-durable-provider-runtime-strong-mutation-response-v1" as const;
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
const ProcessIdV1Schema = z.number().int().min(1).max(0x7fff_ffff);
const ProviderRuntimeIpcStrongMutationOperationV1Schema = z.enum([
  "write_object",
  "compare_commit",
]);

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

export const ProviderRuntimeIpcPrincipalChallengeV1Schema = z.strictObject({
  protocol: ProviderRuntimeIpcProtocolV1Schema,
  kind: z.literal("principal_challenge"),
  challenge: LowerHex64V1Schema,
  acceptanceIdentityProofRequested: z.literal(true).optional(),
  sessionContinuationRequested: z.literal(true).optional(),
});
export type ProviderRuntimeIpcPrincipalChallengeV1 = z.infer<
  typeof ProviderRuntimeIpcPrincipalChallengeV1Schema
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

export const ProviderRuntimeIpcAcceptanceIdentityProofV1Schema = z.strictObject({
  generationId: ProviderAcceptanceStateGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  acceptanceOrdinal: PositiveSafeIntegerV1Schema,
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
});
export type ProviderRuntimeIpcAcceptanceIdentityProofV1 = z.infer<
  typeof ProviderRuntimeIpcAcceptanceIdentityProofV1Schema
>;

export const ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1Schema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/u)
  .brand<"ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1">();
export type ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1 = z.infer<
  typeof ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1Schema
>;

export const ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1Schema =
  CanonicalByteStringV1Schema.refine(
    (value) => {
      const bodyLength = value.length - "base64url:".length;
      return Math.floor((bodyLength * 6) / 8) === 64;
    },
    { message: "must contain exactly 64 canonical Ed25519 signature bytes" },
  ).brand<"ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1">();
export type ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1 =
  z.infer<
    typeof ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1Schema
  >;

const ProviderRuntimeIpcStrongMutationAuthorityGrantJournalHeadShapeV1 = {
  revision: NonnegativeSafeIntegerV1Schema,
  phase: z.string().min(1).max(128),
  mutationDigest: z.union([ContentDigestV1Schema, z.literal("none")]),
} as const;

export const ProviderRuntimeIpcStrongMutationAuthorityGrantJournalHeadV1Schema =
  z.strictObject(
    ProviderRuntimeIpcStrongMutationAuthorityGrantJournalHeadShapeV1,
  );
export type ProviderRuntimeIpcStrongMutationAuthorityGrantJournalHeadV1 =
  z.infer<
    typeof ProviderRuntimeIpcStrongMutationAuthorityGrantJournalHeadV1Schema
  >;

const ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsShapeV1 = {
  signerKeyId: StoreProviderVerificationKeyIdV1Schema,
  providerId: DurableObjectIdentityProviderIdV1Schema,
  targetProfileId: ProviderTargetProfileIdV1Schema,
  targetFingerprintDigest: ContentDigestV1Schema,
  registryManifest: ProviderRegistryManifestPinV1Schema,
  acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  capabilityDigest: ContentDigestV1Schema,
  principalAttestationDigest: ContentDigestV1Schema,
  journalHead:
    ProviderRuntimeIpcStrongMutationAuthorityGrantJournalHeadV1Schema,
  operation: ProviderRuntimeIpcStrongMutationOperationV1Schema,
  operationNonce: LowerHex32V1Schema,
  requestDigest: ContentDigestV1Schema,
} as const;

export const ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema =
  z.strictObject(
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsShapeV1,
  );
export type ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1 = z.infer<
  typeof ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema
>;

const ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsShapeV1 = {
  profile: z.literal(
    "provider_runtime_ipc_strong_mutation_authority_grant_v1",
  ),
  grantId: ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1Schema,
  ...ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsShapeV1,
} as const;

function projectStrongMutationAuthorityGrantIdFieldsV1(
  claims: z.infer<
    typeof ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsBaseV1Schema
  > & {
    readonly signature?: ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1;
  },
): ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1 {
  const {
    profile: _profile,
    grantId: _grantId,
    signature: _signature,
    ...fields
  } = claims;
  return ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema.parse(
    fields,
  );
}

function addStrongMutationAuthorityGrantIdIssueV1(
  claims: z.infer<
    typeof ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsBaseV1Schema
  > & {
    readonly signature?: ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1;
  },
  context: z.RefinementCtx,
): void {
  if (
    claims.grantId !==
    deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(
      projectStrongMutationAuthorityGrantIdFieldsV1(claims),
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["grantId"],
      message: "strong mutation authority grantId must bind the exact claims",
    });
  }
}

const ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsBaseV1Schema =
  z.strictObject(
    ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsShapeV1,
  );

export const ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1Schema =
  ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsBaseV1Schema.superRefine(
    addStrongMutationAuthorityGrantIdIssueV1,
  );
export type ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1 =
  z.infer<
    typeof ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1Schema
  >;

const ProviderRuntimeIpcStrongMutationAuthorityGrantPayloadBaseV1Schema =
  z.strictObject({
    ...ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsShapeV1,
    signature:
      ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1Schema,
  });

export const ProviderRuntimeIpcStrongMutationAuthorityGrantPayloadV1Schema =
  ProviderRuntimeIpcStrongMutationAuthorityGrantPayloadBaseV1Schema.superRefine(
    addStrongMutationAuthorityGrantIdIssueV1,
  );
export type ProviderRuntimeIpcStrongMutationAuthorityGrantPayloadV1 = z.infer<
  typeof ProviderRuntimeIpcStrongMutationAuthorityGrantPayloadV1Schema
>;

const ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeBaseV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal(
      "provider_runtime_ipc_strong_mutation_authority_grant",
    ),
    grantId: ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1Schema,
    contentDigest: ContentDigestV1Schema,
    payload: ProviderRuntimeIpcStrongMutationAuthorityGrantPayloadV1Schema,
  });

export const ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema =
  ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeBaseV1Schema.superRefine(
    (envelope, context) => {
      if (envelope.grantId !== envelope.payload.grantId) {
        context.addIssue({
          code: "custom",
          path: ["grantId"],
          message: "authority grant Envelope grantId must equal payload grantId",
        });
      }
      if (
        envelope.contentDigest !==
        deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
          envelope.payload,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["contentDigest"],
          message:
            "authority grant Envelope contentDigest must bind the complete payload",
        });
      }
    },
  );
export type ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1 = z.infer<
  typeof ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema
>;

export const ProviderRuntimeIpcStrongMutationSessionBindingClaimsV1Schema =
  z.strictObject({
    principalAttestationDigest: ContentDigestV1Schema,
    operation: ProviderRuntimeIpcStrongMutationOperationV1Schema,
    operationNonce: LowerHex32V1Schema,
    requestDigest: ContentDigestV1Schema,
    authorityGrant:
      ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema,
  });
export type ProviderRuntimeIpcStrongMutationSessionBindingClaimsV1 = z.infer<
  typeof ProviderRuntimeIpcStrongMutationSessionBindingClaimsV1Schema
>;

const ProviderRuntimeIpcPrincipalAttestationClaimsShapeV1 = {
  providerId: DurableObjectIdentityProviderIdV1Schema,
  capabilityDigest: ContentDigestV1Schema,
  challenge: LowerHex64V1Schema,
  connectionNonce: LowerHex64V1Schema.optional(),
  processId: ProcessIdV1Schema,
  revision: NonnegativeSafeIntegerV1Schema,
  phase: z.string().min(1).max(128),
  mutationDigest: z.union([ContentDigestV1Schema, z.literal("none")]),
  handoffPayloadDigest: ContentDigestV1Schema,
  publicKey: CanonicalByteStringV1Schema,
  acceptanceIdentity:
    ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.optional(),
} as const;

export const ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema =
  z.strictObject(ProviderRuntimeIpcPrincipalAttestationClaimsShapeV1);
export type ProviderRuntimeIpcPrincipalAttestationClaimsV1 = z.infer<
  typeof ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema
>;

export const ProviderRuntimeIpcPrincipalAttestationV1Schema = z.strictObject({
  protocol: ProviderRuntimeIpcProtocolV1Schema,
  kind: z.literal("principal_attestation"),
  ...ProviderRuntimeIpcPrincipalAttestationClaimsShapeV1,
  signature: CanonicalByteStringV1Schema,
});
export type ProviderRuntimeIpcPrincipalAttestationV1 = z.infer<
  typeof ProviderRuntimeIpcPrincipalAttestationV1Schema
>;

export const ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema =
  z.discriminatedUnion("operation", [
    z.strictObject({
      operation: z.literal("write_object"),
      operationNonce: LowerHex32V1Schema,
      payload: ProviderRuntimeIpcWriteObjectRequestV1Schema.shape.payload,
    }),
    z.strictObject({
      operation: z.literal("compare_commit"),
      operationNonce: LowerHex32V1Schema,
      payload: ProviderRuntimeIpcCompareCommitRequestV1Schema.shape.payload,
    }),
  ]).superRefine((request, context) => {
    if (
      request.operation === "compare_commit" &&
      request.operationNonce !== request.payload.operationNonce
    ) {
      context.addIssue({
        code: "custom",
        path: ["operationNonce"],
        message:
          "strong mutation operationNonce must equal compare_commit payload operationNonce",
      });
    }
  });
export type ProviderRuntimeIpcStrongMutationRequestClaimsV1 = z.infer<
  typeof ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema
>;

const ProviderRuntimeIpcStrongMutationRequestCommonShapeV1 = {
  protocol: ProviderRuntimeIpcProtocolV1Schema,
  kind: z.literal("strong_mutation_request"),
  requestId: LowerHex32V1Schema,
  principalAttestationDigest: ContentDigestV1Schema,
  bindingDigest: ContentDigestV1Schema,
  operationNonce: LowerHex32V1Schema,
  requestDigest: ContentDigestV1Schema,
  authorityGrant:
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema,
} as const;

export const ProviderRuntimeIpcStrongMutationRequestV1Schema = z
  .discriminatedUnion("operation", [
    z.strictObject({
      ...ProviderRuntimeIpcStrongMutationRequestCommonShapeV1,
      operation: z.literal("write_object"),
      payload: ProviderRuntimeIpcWriteObjectRequestV1Schema.shape.payload,
    }),
    z.strictObject({
      ...ProviderRuntimeIpcStrongMutationRequestCommonShapeV1,
      operation: z.literal("compare_commit"),
      payload: ProviderRuntimeIpcCompareCommitRequestV1Schema.shape.payload,
    }),
  ])
  .superRefine((request, context) => {
    if (
      request.operation === "compare_commit" &&
      request.operationNonce !== request.payload.operationNonce
    ) {
      context.addIssue({
        code: "custom",
        path: ["operationNonce"],
        message:
          "strong mutation operationNonce must equal compare_commit payload operationNonce",
      });
    }
  });
export type ProviderRuntimeIpcStrongMutationRequestV1 = z.infer<
  typeof ProviderRuntimeIpcStrongMutationRequestV1Schema
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

const ProviderRuntimeIpcErrorBodyV1Schema = z.strictObject({
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
});

const ProviderRuntimeIpcStrongMutationResponseCommonShapeV1 = {
  protocol: ProviderRuntimeIpcProtocolV1Schema,
  kind: z.literal("strong_mutation_response"),
  requestId: LowerHex32V1Schema,
  principalAttestationDigest: ContentDigestV1Schema,
  bindingDigest: ContentDigestV1Schema,
  operation: ProviderRuntimeIpcStrongMutationOperationV1Schema,
  operationNonce: LowerHex32V1Schema,
  requestDigest: ContentDigestV1Schema,
  signature: CanonicalByteStringV1Schema,
} as const;
const ProviderRuntimeIpcStrongMutationSuccessPayloadV1Schema =
  z.discriminatedUnion("operation", [
    ProviderRuntimeIpcWriteObjectResultV1Schema,
    ProviderRuntimeIpcCompareCommitResultV1Schema,
  ]);
export const ProviderRuntimeIpcStrongMutationResponseV1Schema = z
  .discriminatedUnion("ok", [
    z.strictObject({
      ...ProviderRuntimeIpcStrongMutationResponseCommonShapeV1,
      ok: z.literal(true),
      payload: ProviderRuntimeIpcStrongMutationSuccessPayloadV1Schema,
    }),
    z.strictObject({
      ...ProviderRuntimeIpcStrongMutationResponseCommonShapeV1,
      ok: z.literal(false),
      error: ProviderRuntimeIpcErrorBodyV1Schema,
    }),
  ])
  .superRefine((response, context) => {
    if (response.ok && response.operation !== response.payload.operation) {
      context.addIssue({
        code: "custom",
        path: ["payload", "operation"],
        message:
          "strong mutation response operation must equal payload operation",
      });
    }
  });
export type ProviderRuntimeIpcStrongMutationResponseV1 = z.infer<
  typeof ProviderRuntimeIpcStrongMutationResponseV1Schema
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
  error: ProviderRuntimeIpcErrorBodyV1Schema,
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

/** Canonical bytes signed by the configured principal-owned Ed25519 key. */
export function canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1(
  claims: ProviderRuntimeIpcPrincipalAttestationClaimsV1,
): Uint8Array {
  return canonicalizeJcsSafeIntegerUtf8V1({
    domain: PROVIDER_RUNTIME_IPC_PRINCIPAL_ATTESTATION_DOMAIN_V1,
    claims: ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema.parse(claims),
  });
}

/** Canonical transcript bytes; callers apply SHA-256 for the wire digest. */
export function canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1(
  attestation: ProviderRuntimeIpcPrincipalAttestationV1,
): Uint8Array {
  return canonicalizeJcsSafeIntegerUtf8V1({
    domain: PROVIDER_RUNTIME_IPC_PRINCIPAL_ATTESTATION_TRANSCRIPT_DOMAIN_V1,
    attestation: ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(
      attestation,
    ),
  });
}

/** Stable logical-mutation bytes; connection/session fields are excluded. */
export function canonicalizeProviderRuntimeIpcStrongMutationRequestV1(
  request: ProviderRuntimeIpcStrongMutationRequestClaimsV1,
): Uint8Array {
  const parsed =
    ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema.parse(request);
  return canonicalizeJcsSafeIntegerUtf8V1({
    domain: PROVIDER_RUNTIME_IPC_STRONG_MUTATION_REQUEST_DOMAIN_V1,
    operation: parsed.operation,
    operationNonce: parsed.operationNonce,
    payload: parsed.payload,
  });
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function deriveStrongMutationAuthorityGrantDigestV1(
  domain: string,
  fields: object,
): string {
  return `sha256:${bytesToLowerHexV1(
    sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
  )}`;
}

/** Deterministic identifier over every authority claim except profile/grantId. */
export function deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(
  input: unknown,
): ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1 {
  const fields =
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema.parse(
      input,
    );
  return ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1Schema.parse(
    deriveStrongMutationAuthorityGrantDigestV1(
      PROVIDER_RUNTIME_IPC_STRONG_MUTATION_AUTHORITY_GRANT_ID_DOMAIN_V1,
      fields,
    ),
  );
}

/** Projects the exact claims signed by a Registry-selected authority key. */
export function projectProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1(
  input: unknown,
): ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1 {
  const payload =
    ProviderRuntimeIpcStrongMutationAuthorityGrantPayloadV1Schema.safeParse(
      input,
    );
  if (payload.success) {
    const { signature: _signature, ...claims } = payload.data;
    return ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1Schema.parse(
      claims,
    );
  }
  return ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1Schema.parse(
    input,
  );
}

/** Canonical raw Ed25519 message; no signer or private-key operation is exposed. */
export function createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
  input: unknown,
): Uint8Array {
  const claims =
    projectProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1(
      input,
    );
  return createDomainPreimageBytesV1(
    PROVIDER_RUNTIME_IPC_STRONG_MUTATION_AUTHORITY_GRANT_SIGNATURE_DOMAIN_V1,
    {
      signerKeyId: claims.signerKeyId,
      claims,
    },
  );
}

/** Content digest binds the complete signed payload, including the raw signature. */
export function deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
  input: unknown,
): z.infer<typeof ContentDigestV1Schema> {
  const payload =
    ProviderRuntimeIpcStrongMutationAuthorityGrantPayloadV1Schema.parse(input);
  return ContentDigestV1Schema.parse(
    deriveStrongMutationAuthorityGrantDigestV1(
      PROVIDER_RUNTIME_IPC_STRONG_MUTATION_AUTHORITY_GRANT_DOMAIN_V1,
      payload,
    ),
  );
}

/** Strict structural and self-binding parse; cryptographic verification is separate. */
export function parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1(
  input: unknown,
): ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1 {
  return ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse(
    input,
  );
}

/** Canonical same-connection grant binding bytes; callers apply SHA-256. */
export function canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1(
  claims: ProviderRuntimeIpcStrongMutationSessionBindingClaimsV1,
): Uint8Array {
  return canonicalizeJcsSafeIntegerUtf8V1({
    domain: PROVIDER_RUNTIME_IPC_STRONG_MUTATION_SESSION_BINDING_DOMAIN_V1,
    claims:
      ProviderRuntimeIpcStrongMutationSessionBindingClaimsV1Schema.parse(
        claims,
      ),
  });
}

/** Canonical claims signed by the live service key for a strong response. */
export function canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(
  response: ProviderRuntimeIpcStrongMutationResponseV1,
): Uint8Array {
  const parsed = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
    response,
  );
  const { signature: _signature, ...claims } = parsed;
  return canonicalizeJcsSafeIntegerUtf8V1({
    domain: PROVIDER_RUNTIME_IPC_STRONG_MUTATION_RESPONSE_DOMAIN_V1,
    claims,
  });
}
