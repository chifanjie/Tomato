import {
  generateKeyPairSync,
  sign as signEd25519,
  verify as verifyEd25519,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  PROVIDER_RUNTIME_IPC_STRONG_MUTATION_AUTHORITY_GRANT_SIGNATURE_DOMAIN_V1,
  ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
  parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
} from "../src/provider-runtime-ipc-v1.js";

const PROVIDER_ID =
  "durable-object-provider:strong-authority-grant-contract" as const;
const PRINCIPAL_ATTESTATION_DIGEST = `sha256:${"2".repeat(64)}` as const;
const OPERATION_NONCE = "3".repeat(32);
const REQUEST_DIGEST = `sha256:${"4".repeat(64)}` as const;

function idFieldsV1() {
  return {
    signerKeyId: "a".repeat(22),
    providerId: PROVIDER_ID,
    targetProfileId: `provider-target-profile:${"5".repeat(64)}`,
    targetFingerprintDigest: `sha256:${"6".repeat(64)}`,
    registryManifest: {
      locatorProfile: "installation_provider_registry_manifest_v1" as const,
      manifestGeneration: 11,
      generationId: `provider-registry-manifest:${"b".repeat(22)}`,
      contentDigest: `sha256:${"c".repeat(64)}`,
    },
    acceptanceIdentity: {
      generationId: `provider-acceptance-state:${"d".repeat(22)}`,
      contentDigest: `sha256:${"e".repeat(64)}`,
      acceptanceOrdinal: 7,
      installationIdentityGenerationId:
        `installation-identity-generation:${"f".repeat(22)}`,
    },
    capabilityDigest: `sha256:${"1".repeat(64)}`,
    principalAttestationDigest: PRINCIPAL_ATTESTATION_DIGEST,
    journalHead: {
      revision: 9,
      phase: "final_strong_ready",
      mutationDigest: `sha256:${"5".repeat(64)}`,
    },
    operation: "write_object" as const,
    operationNonce: OPERATION_NONCE,
    requestDigest: REQUEST_DIGEST,
  };
}

function signedEnvelopeV1() {
  const fields = idFieldsV1();
  const grantId =
    deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(fields);
  const unsignedClaims = {
    profile:
      "provider_runtime_ipc_strong_mutation_authority_grant_v1" as const,
    grantId,
    ...fields,
  };
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const signatureBytes = signEd25519(
    null,
    createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
      unsignedClaims,
    ),
    privateKey,
  );
  const payload = {
    ...unsignedClaims,
    signature: `base64url:${signatureBytes.toString("base64url")}`,
  };
  const envelope = {
    schemaVersion: 1 as const,
    recordType:
      "provider_runtime_ipc_strong_mutation_authority_grant" as const,
    grantId,
    contentDigest:
      deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
        payload,
      ),
    payload,
  };
  return { envelope, publicKey, signatureBytes, unsignedClaims };
}

describe("provider runtime strong mutation Ed25519 authority grant", () => {
  it("derives, signs, and strictly parses one exact self-bound Envelope", () => {
    const { envelope, publicKey, signatureBytes, unsignedClaims } =
      signedEnvelopeV1();
    const parsed =
      parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1(envelope);

    expect(parsed).toEqual(envelope);
    expect(parsed.grantId).toBe(
      "sha256:e063c1ce900acf63ac3ae9f1b864e6f2e8edc25361a01c5b7c49ccdaa27bcec6",
    );
    expect(parsed.grantId).toBe(parsed.payload.grantId);
    expect(parsed.payload.signature).toBe(
      `base64url:${signatureBytes.toString("base64url")}`,
    );
    expect(
      verifyEd25519(
        null,
        createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
          parsed.payload,
        ),
        publicKey,
        signatureBytes,
      ),
    ).toBe(true);

    const signingTranscript = new TextDecoder().decode(
      createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
        unsignedClaims,
      ),
    );
    expect(signingTranscript).toContain(
      PROVIDER_RUNTIME_IPC_STRONG_MUTATION_AUTHORITY_GRANT_SIGNATURE_DOMAIN_V1,
    );
    expect(signingTranscript).toContain(unsignedClaims.signerKeyId);
    expect(signingTranscript).not.toContain('"signature"');
    expect(parsed.payload).not.toHaveProperty("bindingDigest");
    expect(parsed.payload).not.toHaveProperty("requestId");
    expect(parsed.payload).not.toHaveProperty("issuedAt");
    expect(parsed.payload).not.toHaveProperty("expiresAt");
  });

  it("binds every identifier field and the complete signed payload", () => {
    const { envelope } = signedEnvelopeV1();
    const changedFields = {
      ...idFieldsV1(),
      journalHead: { ...idFieldsV1().journalHead, revision: 10 },
    };
    expect(
      deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(changedFields),
    ).not.toBe(envelope.grantId);
    expect(
      deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1({
        ...idFieldsV1(),
        targetProfileId: `provider-target-profile:${"0".repeat(64)}`,
      }),
    ).not.toBe(envelope.grantId);
    expect(
      deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1({
        ...idFieldsV1(),
        targetFingerprintDigest: `sha256:${"0".repeat(64)}`,
      }),
    ).not.toBe(envelope.grantId);

    expect(() =>
      ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse({
        ...envelope,
        grantId: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow();
    expect(() =>
      ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse({
        ...envelope,
        contentDigest: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow();
    expect(() =>
      ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse({
        ...envelope,
        payload: {
          ...envelope.payload,
          requestDigest: `sha256:${"0".repeat(64)}`,
        },
      }),
    ).toThrow();
    expect(() =>
      ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse({
        ...envelope,
        unexpected: true,
      }),
    ).toThrow();
  });

  it("admits only canonical unpadded raw 64-byte signatures", () => {
    const canonical = `base64url:${Buffer.alloc(64).toString("base64url")}`;
    expect(
      ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1Schema.parse(
        canonical,
      ),
    ).toBe(canonical);
    expect(() =>
      ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1Schema.parse(
        `base64url:${Buffer.alloc(63).toString("base64url")}`,
      ),
    ).toThrow();
    expect(() =>
      ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1Schema.parse(
        `${canonical}==`,
      ),
    ).toThrow();
    expect(() =>
      ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1Schema.parse(
        `base64url:${Buffer.alloc(64, 0xff).toString("base64")}`,
      ),
    ).toThrow();
  });

  it("requires the typed Envelope on the strong request wire", () => {
    const { envelope } = signedEnvelopeV1();
    const payload = {
      locator: {
        providerId: PROVIDER_ID,
        contentDigest: `sha256:${"6".repeat(64)}`,
      },
      logicalBytes: 1,
      bytes: "base64url:AQ",
    };
    const request = {
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "strong_mutation_request" as const,
      requestId: "7".repeat(32),
      principalAttestationDigest: PRINCIPAL_ATTESTATION_DIGEST,
      bindingDigest: `sha256:${"8".repeat(64)}`,
      operation: "write_object" as const,
      operationNonce: OPERATION_NONCE,
      requestDigest: REQUEST_DIGEST,
      authorityGrant: envelope,
      payload,
    };
    expect(ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(request)).toEqual(
      request,
    );
    expect(() =>
      ProviderRuntimeIpcStrongMutationRequestV1Schema.parse({
        ...request,
        authorityGrant: "base64url:AQ",
      }),
    ).toThrow();
  });
});
