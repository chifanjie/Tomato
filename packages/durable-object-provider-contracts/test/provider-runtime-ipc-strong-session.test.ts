import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  LowerHex32V1Schema,
} from "../src/primitives.js";

import {
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcClientHelloV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcPrincipalChallengeV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  canonicalizeProviderRuntimeIpcStrongMutationRequestV1,
  canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1,
  canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1,
} from "../src/provider-runtime-ipc-v1.js";

const PRINCIPAL_ATTESTATION_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"b".repeat(64)}`,
);
const OPERATION_NONCE = LowerHex32V1Schema.parse("e".repeat(32));
const PROVIDER_ID = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:ipc-strong-session-test",
);

function sha256V1(bytes: Uint8Array) {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  );
}

function writeMutationV1() {
  const bytes = Buffer.from("same socket strong mutation", "utf8");
  const payload = {
    locator: {
      providerId: PROVIDER_ID,
      contentDigest: sha256V1(bytes),
    },
    logicalBytes: bytes.byteLength,
    bytes: CanonicalByteStringV1Schema.parse(
      `base64url:${bytes.toString("base64url")}`,
    ),
  };
  const requestDigest = sha256V1(
    canonicalizeProviderRuntimeIpcStrongMutationRequestV1({
      operation: "write_object",
      operationNonce: OPERATION_NONCE,
      payload,
    }),
  );
  const authorityGrant = CanonicalByteStringV1Schema.parse("base64url:AQ");
  const bindingDigest = sha256V1(
    canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1({
      principalAttestationDigest: PRINCIPAL_ATTESTATION_DIGEST,
      operation: "write_object",
      operationNonce: OPERATION_NONCE,
      requestDigest,
      authorityGrant,
    }),
  );
  return { payload, requestDigest, bindingDigest, authorityGrant };
}

describe("provider runtime non-HMAC strong mutation continuation wire", () => {
  it("keeps old challenges valid and selects continuation only by an exact literal", () => {
    const challenge = {
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "principal_challenge" as const,
      challenge: "1".repeat(64),
      acceptanceIdentityProofRequested: true as const,
    };
    expect(
      ProviderRuntimeIpcPrincipalChallengeV1Schema.parse(challenge)
        .sessionContinuationRequested,
    ).toBeUndefined();
    expect(
      ProviderRuntimeIpcPrincipalChallengeV1Schema.parse({
        ...challenge,
        sessionContinuationRequested: true,
      }).sessionContinuationRequested,
    ).toBe(true);
    expect(() =>
      ProviderRuntimeIpcPrincipalChallengeV1Schema.parse({
        ...challenge,
        sessionContinuationRequested: false,
      }),
    ).toThrow();

    const attestation = {
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "principal_attestation" as const,
      providerId: PROVIDER_ID,
      capabilityDigest: ContentDigestV1Schema.parse(
        `sha256:${"a".repeat(64)}`,
      ),
      challenge: challenge.challenge,
      processId: 1,
      revision: 0,
      phase: "ready",
      mutationDigest: "none" as const,
      handoffPayloadDigest: ContentDigestV1Schema.parse(
        `sha256:${"c".repeat(64)}`,
      ),
      publicKey: CanonicalByteStringV1Schema.parse("base64url:AQ"),
      signature: CanonicalByteStringV1Schema.parse("base64url:Ag"),
    };
    expect(
      ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(attestation),
    ).not.toHaveProperty("connectionNonce");
    expect(
      ProviderRuntimeIpcPrincipalAttestationV1Schema.parse({
        ...attestation,
        connectionNonce: "9".repeat(64),
      }).connectionNonce,
    ).toBe("9".repeat(64));
    expect(() =>
      ProviderRuntimeIpcPrincipalAttestationV1Schema.parse({
        ...attestation,
        connectionNonce: "9".repeat(32),
      }),
    ).toThrow();
  });

  it("uses a dedicated strict request with no HMAC or shared-key hello fields", () => {
    const mutation = writeMutationV1();
    const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse({
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "strong_mutation_request",
      requestId: "2".repeat(32),
      principalAttestationDigest: PRINCIPAL_ATTESTATION_DIGEST,
      bindingDigest: mutation.bindingDigest,
      operation: "write_object",
      operationNonce: OPERATION_NONCE,
      requestDigest: mutation.requestDigest,
      authorityGrant: mutation.authorityGrant,
      payload: mutation.payload,
    });
    expect(request).not.toHaveProperty("authTag");
    expect(request).not.toHaveProperty("sessionId");
    expect(request.requestDigest).toBe(mutation.requestDigest);

    // Compatibility stays strict: the old HMAC hello cannot smuggle a strong
    // continuation object into the shared-key path.
    expect(() =>
      ProviderRuntimeIpcClientHelloV1Schema.parse({
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "client_hello",
        clientNonce: "3".repeat(64),
        capabilityDigest: `sha256:${"4".repeat(64)}`,
        strongMutationSession: {},
        authTag: `hmac-sha256:${"5".repeat(64)}`,
      }),
    ).toThrow();
  });

  it("strictly binds a service-signed response and rejects nonce splitting", () => {
    const mutation = writeMutationV1();
    const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "strong_mutation_response",
      requestId: "2".repeat(32),
      principalAttestationDigest: PRINCIPAL_ATTESTATION_DIGEST,
      bindingDigest: mutation.bindingDigest,
      operation: "write_object",
      operationNonce: OPERATION_NONCE,
      requestDigest: mutation.requestDigest,
      ok: true,
      payload: {
        operation: "write_object",
        resolution: "committed",
        locator: mutation.payload.locator,
        logicalBytes: mutation.payload.logicalBytes,
        verifiedContentDigest: mutation.payload.locator.contentDigest,
      },
      signature: "base64url:AQ",
    });
    const canonical = new TextDecoder().decode(
      canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(response),
    );
    expect(canonical).toContain(mutation.bindingDigest);
    expect(canonical).not.toContain('"signature"');

    expect(() =>
      ProviderRuntimeIpcStrongMutationRequestV1Schema.parse({
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "strong_mutation_request",
        requestId: "2".repeat(32),
        principalAttestationDigest: PRINCIPAL_ATTESTATION_DIGEST,
        bindingDigest: mutation.bindingDigest,
        operation: "compare_commit",
        operationNonce: OPERATION_NONCE,
        requestDigest: mutation.requestDigest,
        authorityGrant: mutation.authorityGrant,
        payload: {
          expectedRevision: 7,
          operationNonce: "6".repeat(32),
          phase: "next",
          artifacts: {},
        },
      }),
    ).toThrow();
  });
});
