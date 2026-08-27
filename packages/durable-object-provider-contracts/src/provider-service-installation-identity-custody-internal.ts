/**
 * Service-only Installation Identity custody recovery seam.
 *
 * The caller supplies the complete signed tuple and exact raw key.  Successful
 * minting returns only the existing opaque verification capability; neither
 * the key nor the captured crypto host can be projected through this facade.
 */

import type {
  InstallationIdentityGenerationIdV1,
  KeyedStateTokenV1,
  LowerHex32V1,
} from "./primitives.js";
import {
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
  verifyProviderFormalAcceptanceStateTokenWithIdentityCapabilityInternalV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import {
  ProviderAcceptanceStateEnvelopeV1Schema,
} from "./provider-acceptance.js";
import { sha256InternalV1 } from "./sha256.js";

const SHA256_BLOCK_BYTES_V1 = 64;

function hmacSha256InternalV1(
  key: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  const normalizedKey =
    key.byteLength > SHA256_BLOCK_BYTES_V1 ? sha256InternalV1(key) : key;
  const innerPad = new Uint8Array(SHA256_BLOCK_BYTES_V1);
  const outerPad = new Uint8Array(SHA256_BLOCK_BYTES_V1);
  for (let index = 0; index < SHA256_BLOCK_BYTES_V1; index += 1) {
    const keyByte = index < normalizedKey.byteLength ? normalizedKey[index]! : 0;
    innerPad[index] = keyByte ^ 0x36;
    outerPad[index] = keyByte ^ 0x5c;
  }

  const innerMessage = new Uint8Array(innerPad.byteLength + message.byteLength);
  innerMessage.set(innerPad);
  innerMessage.set(message, innerPad.byteLength);
  const innerDigest = sha256InternalV1(innerMessage);
  const outerMessage = new Uint8Array(outerPad.byteLength + innerDigest.byteLength);
  outerMessage.set(outerPad);
  outerMessage.set(innerDigest, outerPad.byteLength);
  return sha256InternalV1(outerMessage);
}

export interface MintProviderServiceInstallationIdentityVerificationCapabilityInternalV1Input {
  readonly installationIdentityKey: Uint8Array;
  readonly initializationNonce: LowerHex32V1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly keyCheckToken: KeyedStateTokenV1;
}

export type ProviderServiceInstallationIdentityVerificationCapabilityInternalV1 =
  ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;

/** Mint an opaque capability from the exact principal-owned custody tuple. */
export function mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1(
  input: MintProviderServiceInstallationIdentityVerificationCapabilityInternalV1Input,
): Promise<ProviderServiceInstallationIdentityVerificationCapabilityInternalV1> {
  return mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1({
    initializationNonce: input.initializationNonce,
    installationIdentityGenerationId: input.installationIdentityGenerationId,
    keyCheckToken: input.keyCheckToken,
    installationIdentityKey: input.installationIdentityKey,
    cryptoHost: {
      sha256(message: Uint8Array): Uint8Array {
        return sha256InternalV1(message);
      },
      hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
        return hmacSha256InternalV1(key, message);
      },
    },
  });
}

/** Verify one exact formal Acceptance without exposing Installation Identity key bytes. */
export async function verifyProviderServiceFormalAcceptanceEnvelopeWithIdentityCapabilityInternalV1(
  capability: ProviderServiceInstallationIdentityVerificationCapabilityInternalV1,
  envelopeInput: unknown,
): Promise<boolean> {
  try {
    const envelope = ProviderAcceptanceStateEnvelopeV1Schema.parse(
      envelopeInput,
    );
    return await verifyProviderFormalAcceptanceStateTokenWithIdentityCapabilityInternalV1(
      capability,
      envelope.installationIdentityGenerationId,
      envelope.payload,
      envelope.payload.acceptanceToken,
    );
  } catch {
    return false;
  }
}
