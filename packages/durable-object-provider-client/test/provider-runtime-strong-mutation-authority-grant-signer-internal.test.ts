import {
  createPrivateKey,
  createPublicKey,
  verify,
  type KeyObject,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1Schema,
  createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
  parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
  projectProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1,
  type ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  CanonicalPublicKeyBytes32V1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  StoreProviderVerificationKeyIdV1Schema,
  type CanonicalPublicKeyBytes32V1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import { deriveStoreProviderVerificationKeyIdV1 } from "@understand-code/durable-object-provider-contracts/provider-registry";

import {
  consumeProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
  mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
  type ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
} from "../src/provider-runtime-strong-mutation-authority-grant-signer-internal.js";

const PKCS8_ED25519_SEED_PREFIX_V1 = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);
const PROVIDER_ID_V1 = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:grant-client-test",
);

interface KeyFixtureV1 {
  readonly privateKey: KeyObject;
  readonly pkcs8: Uint8Array;
  readonly publicKeyBytes: CanonicalPublicKeyBytes32V1;
}

function keyFixtureV1(seedOctet: number): KeyFixtureV1 {
  const pkcs8 = Buffer.concat([
    PKCS8_ED25519_SEED_PREFIX_V1,
    Buffer.alloc(32, seedOctet),
  ]);
  const privateKey = createPrivateKey({
    key: pkcs8,
    format: "der",
    type: "pkcs8",
  });
  const spki = Buffer.from(
    createPublicKey(privateKey).export({ format: "der", type: "spki" }),
  );
  return {
    privateKey,
    pkcs8: new Uint8Array(pkcs8),
    publicKeyBytes: CanonicalPublicKeyBytes32V1Schema.parse(
      `base64url:${spki.subarray(-32).toString("base64url")}`,
    ),
  };
}

function signerKeyIdV1(
  publicKeyBytes: CanonicalPublicKeyBytes32V1,
): ReturnType<typeof deriveStoreProviderVerificationKeyIdV1> {
  return deriveStoreProviderVerificationKeyIdV1({
    providerId: PROVIDER_ID_V1,
    usage: "strong_mutation_authority_grant",
    publicKeyBytes,
  });
}

function grantFieldsV1(
  signerKeyId: ReturnType<typeof deriveStoreProviderVerificationKeyIdV1>,
): ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1 {
  return ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema.parse({
    signerKeyId,
    providerId: PROVIDER_ID_V1,
    targetProfileId: `provider-target-profile:${"d".repeat(64)}`,
    targetFingerprintDigest: `sha256:${"e".repeat(64)}`,
    registryManifest: {
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration: 7,
      generationId: `provider-registry-manifest:${"1".repeat(22)}`,
      contentDigest: `sha256:${"2".repeat(64)}`,
    },
    acceptanceIdentity: {
      generationId: `provider-acceptance-state:${"3".repeat(22)}`,
      contentDigest: `sha256:${"4".repeat(64)}`,
      acceptanceOrdinal: 11,
      installationIdentityGenerationId:
        `installation-identity-generation:${"5".repeat(22)}`,
    },
    capabilityDigest: `sha256:${"6".repeat(64)}`,
    principalAttestationDigest: `sha256:${"7".repeat(64)}`,
    journalHead: {
      revision: 13,
      phase: "final_strong_ready",
      mutationDigest: `sha256:${"8".repeat(64)}`,
    },
    operation: "compare_commit",
    operationNonce: "9".repeat(32),
    requestDigest: `sha256:${"a".repeat(64)}`,
  });
}

function expectZeroedV1(bytes: Uint8Array): void {
  expect(Array.from(bytes)).toEqual(new Array(bytes.byteLength).fill(0));
}

describe("client-private strong mutation authority grant signer", () => {
  it("signs one exact immutable grant and burns the opaque capability", () => {
    const key = keyFixtureV1(0x21);
    const privateKeyPkcs8 = new Uint8Array(key.pkcs8);
    const originalFields = structuredClone(
      grantFieldsV1(signerKeyIdV1(key.publicKeyBytes)),
    );
    const grantFields = structuredClone(originalFields);
    const capability =
      mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        {
          privateKeyPkcs8,
          expectedPublicKeyBytes: key.publicKeyBytes,
          grantFields,
        },
      );

    expectZeroedV1(privateKeyPkcs8);
    expect(Object.keys(capability)).toEqual([]);
    expect(Object.isFrozen(capability)).toBe(true);

    // Caller-owned records cannot rewrite the hidden exact-current binding.
    (grantFields.registryManifest as { manifestGeneration: number })
      .manifestGeneration = 99;
    (grantFields.acceptanceIdentity as { acceptanceOrdinal: number })
      .acceptanceOrdinal = 99;
    (grantFields.journalHead as { phase: string }).phase = "rebound";

    const envelope =
      consumeProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        capability,
      );
    expect(envelope).toBeDefined();
    const parsed =
      parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1(envelope);
    expect(
      projectProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1(
        parsed.payload,
      ),
    ).toEqual({
      profile: "provider_runtime_ipc_strong_mutation_authority_grant_v1",
      grantId:
        deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(
          originalFields,
        ),
      ...originalFields,
    });

    const message =
      createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
        parsed.payload,
      );
    const signature = Buffer.from(
      parsed.payload.signature.slice("base64url:".length),
      "base64url",
    );
    expect(
      verify(null, Buffer.from(message), createPublicKey(key.privateKey), signature),
    ).toBe(true);

    expect(
      consumeProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        capability,
      ),
    ).toBeUndefined();
    expect(
      consumeProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        Object.freeze(Object.create(null)) as
          ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
      ),
    ).toBeUndefined();
  });

  it("rejects private/public and Registry keyId mismatches and zeroizes custody bytes", () => {
    const signingKey = keyFixtureV1(0x31);
    const otherKey = keyFixtureV1(0x32);

    const publicMismatchPkcs8 = new Uint8Array(signingKey.pkcs8);
    expect(() =>
      mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        {
          privateKeyPkcs8: publicMismatchPkcs8,
          expectedPublicKeyBytes: otherKey.publicKeyBytes,
          grantFields: grantFieldsV1(signerKeyIdV1(otherKey.publicKeyBytes)),
        },
      ),
    ).toThrow(/private\/public key mismatch/u);
    expectZeroedV1(publicMismatchPkcs8);

    const keyIdMismatchPkcs8 = new Uint8Array(signingKey.pkcs8);
    expect(() =>
      mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        {
          privateKeyPkcs8: keyIdMismatchPkcs8,
          expectedPublicKeyBytes: signingKey.publicKeyBytes,
          grantFields: grantFieldsV1(
            StoreProviderVerificationKeyIdV1Schema.parse("0".repeat(22)),
          ),
        },
      ),
    ).toThrow(/keyId does not match Registry key material/u);
    expectZeroedV1(keyIdMismatchPkcs8);

    const invalidPkcs8 = new Uint8Array([1, 2, 3, 4]);
    expect(() =>
      mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        {
          privateKeyPkcs8: invalidPkcs8,
          expectedPublicKeyBytes: signingKey.publicKeyBytes,
          grantFields: grantFieldsV1(signerKeyIdV1(signingKey.publicKeyBytes)),
        },
      ),
    ).toThrow();
    expectZeroedV1(invalidPkcs8);
  });

  it("does not let a signed grant replay under request or target rebindings", () => {
    const key = keyFixtureV1(0x41);
    const fields = grantFieldsV1(signerKeyIdV1(key.publicKeyBytes));
    const capability =
      mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        {
          privateKeyPkcs8: new Uint8Array(key.pkcs8),
          expectedPublicKeyBytes: key.publicKeyBytes,
          grantFields: fields,
        },
      );
    const envelope =
      consumeProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        capability,
      );
    if (envelope === undefined) throw new TypeError("grant was not signed");

    const originalSignature = Buffer.from(
      envelope.payload.signature.slice("base64url:".length),
      "base64url",
    );
    const verifiesReboundFieldsV1 = (input: unknown): boolean => {
      const reboundFields =
        ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema.parse(
          input,
        );
      const reboundClaims =
        ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1Schema.parse(
          {
            profile:
              "provider_runtime_ipc_strong_mutation_authority_grant_v1",
            grantId:
              deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(
                reboundFields,
              ),
            ...reboundFields,
          },
        );
      const reboundMessage =
        createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
          reboundClaims,
        );
      return verify(
        null,
        Buffer.from(reboundMessage),
        createPublicKey(key.privateKey),
        originalSignature,
      );
    };

    expect(
      verifiesReboundFieldsV1({
        ...fields,
        principalAttestationDigest: `sha256:${"b".repeat(64)}`,
        requestDigest: `sha256:${"c".repeat(64)}`,
      }),
    ).toBe(false);
    expect(
      verifiesReboundFieldsV1({
        ...fields,
        targetProfileId: `provider-target-profile:${"f".repeat(64)}`,
      }),
    ).toBe(false);
    expect(
      verifiesReboundFieldsV1({
        ...fields,
        targetFingerprintDigest: `sha256:${"0".repeat(64)}`,
      }),
    ).toBe(false);
  });
});
