import { createHash } from "node:crypto";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  PROVIDER_RUNTIME_IPC_STRONG_MUTATION_REQUEST_DOMAIN_V1,
  PROVIDER_RUNTIME_IPC_STRONG_MUTATION_SESSION_BINDING_DOMAIN_V1,
  ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
  type ProviderRuntimeIpcStrongMutationRequestV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import type { ProviderAcceptanceCurrentReadV1 } from "@understand-code/durable-object-provider-contracts/provider-acceptance";

export const TEST_BROKER_PROVIDER_ID =
  "durable-object-provider:authority-broker-test" as const;

export function sha256OracleV1(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function canonicalDigestOracleV1(value: unknown): `sha256:${string}` {
  return sha256OracleV1(canonicalizeJcsSafeIntegerUtf8V1(value));
}

export function currentAcceptanceIdentityV1(
  current: ProviderAcceptanceCurrentReadV1,
) {
  const accepted = current.highWater.payload.currentAcceptance;
  return {
    generationId: accepted.generationId,
    contentDigest: accepted.contentDigest,
    acceptanceOrdinal: accepted.acceptanceOrdinal,
    installationIdentityGenerationId:
      current.highWater.payload.installationIdentityGenerationId,
  };
}

export function strongMutationRequestDigestOracleV1(input: Readonly<{
  operation: "write_object" | "compare_commit";
  operationNonce: string;
  payload: unknown;
}>): `sha256:${string}` {
  return canonicalDigestOracleV1({
    domain: PROVIDER_RUNTIME_IPC_STRONG_MUTATION_REQUEST_DOMAIN_V1,
    operation: input.operation,
    operationNonce: input.operationNonce,
    payload: input.payload,
  });
}

export function strongMutationBindingDigestOracleV1(input: Readonly<{
  principalAttestationDigest: string;
  operation: "write_object" | "compare_commit";
  operationNonce: string;
  requestDigest: string;
  authorityGrant: unknown;
}>): `sha256:${string}` {
  return canonicalDigestOracleV1({
    domain: PROVIDER_RUNTIME_IPC_STRONG_MUTATION_SESSION_BINDING_DOMAIN_V1,
    claims: {
      principalAttestationDigest: input.principalAttestationDigest,
      operation: input.operation,
      operationNonce: input.operationNonce,
      requestDigest: input.requestDigest,
      authorityGrant: input.authorityGrant,
    },
  });
}

export function strongMutationRequestV1(
  current: ProviderAcceptanceCurrentReadV1,
  options: Readonly<{
    requestId?: string;
    nonceDigit?: string;
    body?: string;
    principalAttestationDigit?: string;
  }> = {},
): ProviderRuntimeIpcStrongMutationRequestV1 {
  const nonceDigit = options.nonceDigit ?? "3";
  const operationNonce = nonceDigit.repeat(32);
  const bytes = Buffer.from(
    options.body ?? "broker records intent but performs no provider write",
    "utf8",
  );
  const payload = {
    locator: {
      providerId: TEST_BROKER_PROVIDER_ID,
      contentDigest: sha256OracleV1(bytes),
    },
    logicalBytes: bytes.byteLength,
    bytes: `base64url:${bytes.toString("base64url")}` as const,
  };
  const requestDigest = strongMutationRequestDigestOracleV1({
    operation: "write_object",
    operationNonce,
    payload,
  });
  const principalAttestationDigest =
    `sha256:${(options.principalAttestationDigit ?? "2").repeat(64)}` as const;
  const grantFields = {
    signerKeyId: "a".repeat(22),
    providerId: TEST_BROKER_PROVIDER_ID,
    targetProfileId: `provider-target-profile:${"5".repeat(64)}`,
    targetFingerprintDigest: `sha256:${"6".repeat(64)}`,
    registryManifest: {
      locatorProfile: "installation_provider_registry_manifest_v1" as const,
      manifestGeneration: 1,
      generationId: `provider-registry-manifest:${"b".repeat(22)}`,
      contentDigest: `sha256:${"c".repeat(64)}`,
    },
    acceptanceIdentity: currentAcceptanceIdentityV1(current),
    capabilityDigest: `sha256:${"1".repeat(64)}`,
    principalAttestationDigest,
    journalHead: {
      revision: 0,
      phase: "ready",
      mutationDigest: "none" as const,
    },
    operation: "write_object" as const,
    operationNonce,
    requestDigest,
  };
  const grantId =
    deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(grantFields);
  const grantPayload = {
    profile:
      "provider_runtime_ipc_strong_mutation_authority_grant_v1" as const,
    grantId,
    ...grantFields,
    // This candidate intentionally establishes no Registry-key verification.
    signature: `base64url:${Buffer.alloc(64, 7).toString("base64url")}`,
  };
  const authorityGrant =
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_runtime_ipc_strong_mutation_authority_grant",
      grantId,
      contentDigest:
        deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
          grantPayload,
        ),
      payload: grantPayload,
    });
  const bindingDigest = strongMutationBindingDigestOracleV1({
    principalAttestationDigest,
    operation: "write_object",
    operationNonce,
    requestDigest,
    authorityGrant,
  });
  return ProviderRuntimeIpcStrongMutationRequestV1Schema.parse({
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "strong_mutation_request",
    requestId: options.requestId ?? "4".repeat(32),
    principalAttestationDigest,
    bindingDigest,
    operation: "write_object",
    operationNonce,
    requestDigest,
    authorityGrant,
    payload,
  });
}

export function strongMutationCompareRequestV1(
  current: ProviderAcceptanceCurrentReadV1,
  options: Readonly<{
    requestId?: string;
    nonceDigit?: string;
    expectedRevision?: number;
  }> = {},
): ProviderRuntimeIpcStrongMutationRequestV1 {
  const nonceDigit = options.nonceDigit ?? "b";
  const operationNonce = nonceDigit.repeat(32);
  const payload = {
    expectedRevision: options.expectedRevision ?? 7,
    operationNonce,
    phase: "broker-test-committed-phase",
    artifacts: {
      alpha: { digest: `sha256:${"d".repeat(64)}` },
      beta: [1, true, "exact"],
    },
  };
  const requestDigest = strongMutationRequestDigestOracleV1({
    operation: "compare_commit",
    operationNonce,
    payload,
  });
  const principalAttestationDigest = `sha256:${"2".repeat(64)}` as const;
  const grantFields = {
    signerKeyId: "a".repeat(22),
    providerId: TEST_BROKER_PROVIDER_ID,
    targetProfileId: `provider-target-profile:${"5".repeat(64)}`,
    targetFingerprintDigest: `sha256:${"6".repeat(64)}`,
    registryManifest: {
      locatorProfile: "installation_provider_registry_manifest_v1" as const,
      manifestGeneration: 1,
      generationId: `provider-registry-manifest:${"b".repeat(22)}`,
      contentDigest: `sha256:${"c".repeat(64)}`,
    },
    acceptanceIdentity: currentAcceptanceIdentityV1(current),
    capabilityDigest: `sha256:${"1".repeat(64)}`,
    principalAttestationDigest,
    journalHead: {
      revision: payload.expectedRevision,
      phase: "ready",
      mutationDigest: "none" as const,
    },
    operation: "compare_commit" as const,
    operationNonce,
    requestDigest,
  };
  const grantId =
    deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(grantFields);
  const grantPayload = {
    profile:
      "provider_runtime_ipc_strong_mutation_authority_grant_v1" as const,
    grantId,
    ...grantFields,
    signature: `base64url:${Buffer.alloc(64, 7).toString("base64url")}`,
  };
  const authorityGrant =
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_runtime_ipc_strong_mutation_authority_grant",
      grantId,
      contentDigest:
        deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
          grantPayload,
        ),
      payload: grantPayload,
    });
  const bindingDigest = strongMutationBindingDigestOracleV1({
    principalAttestationDigest,
    operation: "compare_commit",
    operationNonce,
    requestDigest,
    authorityGrant,
  });
  return ProviderRuntimeIpcStrongMutationRequestV1Schema.parse({
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "strong_mutation_request",
    requestId: options.requestId ?? "b".repeat(32),
    principalAttestationDigest,
    bindingDigest,
    operation: "compare_commit",
    operationNonce,
    requestDigest,
    authorityGrant,
    payload,
  });
}

export function strongMutationResponseV1(
  request: ProviderRuntimeIpcStrongMutationRequestV1,
  options: Readonly<{
    signatureByte?: number;
  }> = {},
): ProviderRuntimeIpcStrongMutationResponseV1 {
  if (request.operation !== "write_object") {
    throw new Error("broker fixture requires write_object");
  }
  return ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "strong_mutation_response",
    requestId: request.requestId,
    principalAttestationDigest: request.principalAttestationDigest,
    bindingDigest: request.bindingDigest,
    operation: request.operation,
    operationNonce: request.operationNonce,
    requestDigest: request.requestDigest,
    signature: `base64url:${Buffer.alloc(
      64,
      options.signatureByte ?? 9,
    ).toString("base64url")}`,
    ok: true,
    payload: {
      operation: "write_object",
      resolution: "committed",
      locator: request.payload.locator,
      logicalBytes: request.payload.logicalBytes,
      verifiedContentDigest: request.payload.locator.contentDigest,
    },
  });
}

export function strongMutationCompareResponseV1(
  request: ProviderRuntimeIpcStrongMutationRequestV1,
  resolution: "committed" | "replayed" | "stale" | "error" = "committed",
): ProviderRuntimeIpcStrongMutationResponseV1 {
  if (request.operation !== "compare_commit") {
    throw new Error("broker fixture requires compare_commit");
  }
  const common = {
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "strong_mutation_response" as const,
    requestId: request.requestId,
    principalAttestationDigest: request.principalAttestationDigest,
    bindingDigest: request.bindingDigest,
    operation: request.operation,
    operationNonce: request.operationNonce,
    requestDigest: request.requestDigest,
    signature: `base64url:${Buffer.alloc(64, 11).toString("base64url")}`,
  };
  if (resolution === "error") {
    return ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
      ...common,
      ok: false,
      error: {
        code: "storage_failure",
        message: "synthetic provider failure",
      },
    });
  }
  return ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
    ...common,
    ok: true,
    payload: {
      operation: "compare_commit",
      resolution,
      state: resolution === "committed"
        ? {
            profile: "provider_runtime_durable_journal_state_v1",
            revision: request.payload.expectedRevision + 1,
            phase: request.payload.phase,
            operationNonce: request.payload.operationNonce,
            mutationDigest: `sha256:${"e".repeat(64)}`,
            artifacts: request.payload.artifacts,
          }
        : {
            profile: "provider_runtime_durable_journal_state_v1",
            revision: 1,
            phase: "observed-provider-head",
            operationNonce: "none",
            mutationDigest: "none",
            artifacts: { observed: resolution },
          },
    },
  });
}

export function brokerResolveRequestV1(
  intent: Readonly<{
    grantId: string;
    requestContentDigest: string;
    requestDigest: string;
    bindingDigest: string;
  }>,
  response: ProviderRuntimeIpcStrongMutationResponseV1,
) {
  return {
    profile: "provider_strong_mutation_broker_resolve_request_v1" as const,
    grantId: intent.grantId,
    requestContentDigest: intent.requestContentDigest,
    requestDigest: intent.requestDigest,
    bindingDigest: intent.bindingDigest,
    response,
  };
}
