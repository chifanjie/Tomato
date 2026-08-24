import {
  openProviderAcceptanceAuthorityStoreWithLayoutCoreInternalV1,
  type ProviderAcceptanceAuthorityAdmissionInputInternalV1,
  type ProviderAcceptanceAuthorityAdmissionResultInternalV1,
  type ProviderAcceptanceAuthorityCurrentReadResultInternalV1,
  type ProviderAcceptanceAuthorityDoctorResultInternalV1,
  type ProviderAcceptanceAuthorityStoreInternalV1,
} from "./acceptance-store-core-internal.js";
import { resolveProviderAcceptanceAuthorityProductionLayoutInternalV1 } from "./platform-layout.js";
import {
  assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1,
  assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1,
  deriveNativeSafeGitPathIdentityV1,
  type NativeSafeGitDescriptorBindingV1,
  type NativeSafeGitPathIdentityV1,
} from "@understand-code/native-kernel-bridge";
import { openOrInitializeProviderAcceptanceInstallationIdentityInternalV1 } from "./key-custody-internal.js";

export type {
  ProviderAcceptanceAuthorityAdmissionInputInternalV1,
  ProviderAcceptanceAuthorityAdmissionResultInternalV1,
  ProviderAcceptanceAuthorityCurrentReadResultInternalV1,
  ProviderAcceptanceAuthorityDoctorResultInternalV1,
  ProviderAcceptanceAuthorityStoreInternalV1,
};

/** Production opener: its root is fixed by trusted OS account information. */
export async function openProviderAcceptanceAuthorityStoreCandidateInternalV1(): Promise<ProviderAcceptanceAuthorityStoreInternalV1> {
  const layout = resolveProviderAcceptanceAuthorityProductionLayoutInternalV1();
  await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(layout);
  return openProviderAcceptanceAuthorityStoreWithLayoutCoreInternalV1(layout);
}

/**
 * Installation-owner identity derivation facade. Raw key bytes remain inside
 * key custody and are zeroed immediately after the native derivation returns.
 */
export async function deriveProviderAcceptanceSafeGitPathIdentityInternalV1(
  binding: NativeSafeGitDescriptorBindingV1,
): Promise<NativeSafeGitPathIdentityV1> {
  assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(binding);
  const identity =
    await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
      resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
      {
        authorizeNativeAuthority(opened) {
          assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
            opened.authority,
            binding,
          );
        },
      },
    );
  return identity.withKey(async (key) =>
    deriveNativeSafeGitPathIdentityV1(binding, key)
  );
}
