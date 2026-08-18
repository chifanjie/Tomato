/**
 * Node-service-only Installation Identity custody recovery seam.
 *
 * The caller supplies the complete signed tuple and exact raw key.  Successful
 * minting returns only the existing opaque verification capability; neither
 * the key nor the captured crypto host can be projected through this facade.
 */

import { createHash, createHmac } from "node:crypto";

import type {
  InstallationIdentityGenerationIdV1,
  KeyedStateTokenV1,
  LowerHex32V1,
} from "./primitives.js";
import {
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";

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
        return new Uint8Array(createHash("sha256").update(message).digest());
      },
      hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
        return new Uint8Array(
          createHmac("sha256", key).update(message).digest(),
        );
      },
    },
  });
}
