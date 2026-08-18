/**
 * Client-private custody seam for one exact strong-mutation authority grant.
 *
 * This module does not establish Registry or Acceptance currentness. It only
 * binds an externally provisioned Ed25519 private key to the exact, already
 * selected current-state claims. The runtime must independently rejoin those
 * claims to authoritative current state and durably consume the grant.
 *
 * The capability is deliberately absent from the package export surface. Its
 * private key and claims live only in a WeakMap; the zero-own-property handle
 * is consumed delete-before-sign and never projects key material.
 */

import {
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";

import {
  ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantPayloadV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1Schema,
  createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
  parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
  type ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
  type ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1,
  type ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  CanonicalPublicKeyBytes32V1Schema,
  type CanonicalPublicKeyBytes32V1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import { deriveStoreProviderVerificationKeyIdV1 } from "@understand-code/durable-object-provider-contracts/provider-registry";

const ED25519_SPKI_PREFIX_V1 = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);
const ED25519_RAW_PUBLIC_KEY_BYTES_V1 = 32;
const ED25519_SIGNATURE_BYTES_V1 = 64;

declare const providerRuntimeStrongMutationAuthorityGrantSignerBrandV1:
  unique symbol;
export interface ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1 {
  readonly [providerRuntimeStrongMutationAuthorityGrantSignerBrandV1]: true;
}

export interface MintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1Input {
  /** Consumed PKCS#8 DER bytes. This array is zeroized on every return path. */
  readonly privateKeyPkcs8: Uint8Array;
  /** Exact raw32 public key selected by the caller's current Registry view. */
  readonly expectedPublicKeyBytes: CanonicalPublicKeyBytes32V1;
  /**
   * Complete immutable provider/target/current-state binding for the one exact
   * same-socket request.
   */
  readonly grantFields: ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1;
}

interface ProviderRuntimeStrongMutationAuthorityGrantSignerStateInternalV1 {
  readonly privateKey: KeyObject;
  readonly claims: ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1;
}

const signerStatesV1 = new WeakMap<
  object,
  ProviderRuntimeStrongMutationAuthorityGrantSignerStateInternalV1
>();

function freezeGrantClaimsV1(
  claims: ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1,
): ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1 {
  Object.freeze(claims.registryManifest);
  Object.freeze(claims.acceptanceIdentity);
  Object.freeze(claims.journalHead);
  return Object.freeze(claims);
}

function zeroBytesV1(value: Uint8Array | undefined): void {
  value?.fill(0);
}

function exactRawEd25519PublicKeyV1(
  privateKey: KeyObject,
): CanonicalPublicKeyBytes32V1 {
  if (privateKey.type !== "private" || privateKey.asymmetricKeyType !== "ed25519") {
    throw new TypeError("strong mutation authority key must be Ed25519 private key");
  }

  const spki = Buffer.from(
    createPublicKey(privateKey).export({ format: "der", type: "spki" }),
  );
  try {
    if (
      spki.byteLength !==
        ED25519_SPKI_PREFIX_V1.byteLength + ED25519_RAW_PUBLIC_KEY_BYTES_V1 ||
      !spki.subarray(0, ED25519_SPKI_PREFIX_V1.byteLength).equals(
        ED25519_SPKI_PREFIX_V1,
      )
    ) {
      throw new TypeError("strong mutation authority key has invalid Ed25519 SPKI");
    }
    return CanonicalPublicKeyBytes32V1Schema.parse(
      `base64url:${spki
        .subarray(ED25519_SPKI_PREFIX_V1.byteLength)
        .toString("base64url")}`,
    );
  } finally {
    spki.fill(0);
  }
}

/**
 * Imports and validates one client-owned authority key, then mints an opaque
 * signer for exactly one frozen grant. No unsigned DTO minting API exists.
 */
export function mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
  input: MintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1Input,
): ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1 {
  const suppliedPkcs8 = input.privateKeyPkcs8;
  if (!(suppliedPkcs8 instanceof Uint8Array)) {
    throw new TypeError("strong mutation authority PKCS#8 must be bytes");
  }

  let importedPkcs8: Uint8Array | undefined;
  let nodeKeyBytes: Buffer | undefined;
  try {
    importedPkcs8 = new Uint8Array(suppliedPkcs8);
    nodeKeyBytes = Buffer.from(importedPkcs8);
    const expectedPublicKeyBytes =
      CanonicalPublicKeyBytes32V1Schema.parse(input.expectedPublicKeyBytes);
    const grantFields =
      ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema.parse(
        input.grantFields,
      );
    const privateKey = createPrivateKey({
      key: nodeKeyBytes,
      format: "der",
      type: "pkcs8",
    });
    const actualPublicKeyBytes = exactRawEd25519PublicKeyV1(privateKey);
    if (actualPublicKeyBytes !== expectedPublicKeyBytes) {
      throw new TypeError(
        "strong mutation authority private/public key mismatch",
      );
    }

    const derivedSignerKeyId = deriveStoreProviderVerificationKeyIdV1({
      providerId: grantFields.providerId,
      usage: "strong_mutation_authority_grant",
      publicKeyBytes: actualPublicKeyBytes,
    });
    if (grantFields.signerKeyId !== derivedSignerKeyId) {
      throw new TypeError(
        "strong mutation authority signer keyId does not match Registry key material",
      );
    }

    const grantId =
      deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(grantFields);
    const claims = freezeGrantClaimsV1(
      ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1Schema.parse(
        {
          profile:
            "provider_runtime_ipc_strong_mutation_authority_grant_v1",
          grantId,
          ...grantFields,
        },
      ),
    );
    const capability = Object.freeze(Object.create(null)) as
      ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1;
    signerStatesV1.set(
      capability,
      Object.freeze({
        privateKey,
        claims,
      }),
    );
    return capability;
  } finally {
    zeroBytesV1(nodeKeyBytes);
    zeroBytesV1(importedPkcs8);
    zeroBytesV1(suppliedPkcs8);
  }
}

/**
 * Burns the signer before any cryptographic operation and returns the sole
 * typed grant envelope. Foreign, forged, failed, or replayed handles fail
 * closed without invoking a key.
 */
export function consumeProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
  capability:
    ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
): ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1 | undefined {
  const state = signerStatesV1.get(capability as object);
  signerStatesV1.delete(capability as object);
  if (state === undefined) return undefined;

  const signatureMessage =
    createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
      state.claims,
    );
  const nodeMessage = Buffer.from(signatureMessage);
  let rawSignature: Buffer | undefined;
  try {
    rawSignature = sign(null, nodeMessage, state.privateKey);
    if (rawSignature.byteLength !== ED25519_SIGNATURE_BYTES_V1) {
      throw new TypeError(
        "strong mutation authority signature must contain exactly 64 bytes",
      );
    }
    const signature =
      ProviderRuntimeIpcStrongMutationAuthorityGrantSignatureV1Schema.parse(
        `base64url:${rawSignature.toString("base64url")}`,
      );
    const payload =
      ProviderRuntimeIpcStrongMutationAuthorityGrantPayloadV1Schema.parse({
        ...state.claims,
        signature,
      });
    return parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1({
      schemaVersion: 1,
      recordType:
        "provider_runtime_ipc_strong_mutation_authority_grant",
      grantId: payload.grantId,
      contentDigest:
        deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
          payload,
        ),
      payload,
    });
  } finally {
    zeroBytesV1(rawSignature);
    zeroBytesV1(nodeMessage);
    zeroBytesV1(signatureMessage);
  }
}
