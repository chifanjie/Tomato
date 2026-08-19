import {
  openProviderAcceptanceAuthorityStoreWithLayoutCoreInternalV1,
  type ProviderAcceptanceAuthorityAdmissionInputInternalV1,
  type ProviderAcceptanceAuthorityAdmissionResultInternalV1,
  type ProviderAcceptanceAuthorityCurrentReadResultInternalV1,
  type ProviderAcceptanceAuthorityDoctorResultInternalV1,
  type ProviderAcceptanceAuthorityStoreInternalV1,
} from "./acceptance-store-core-internal.js";
import { resolveProviderAcceptanceAuthorityProductionLayoutInternalV1 } from "./platform-layout.js";

export type {
  ProviderAcceptanceAuthorityAdmissionInputInternalV1,
  ProviderAcceptanceAuthorityAdmissionResultInternalV1,
  ProviderAcceptanceAuthorityCurrentReadResultInternalV1,
  ProviderAcceptanceAuthorityDoctorResultInternalV1,
  ProviderAcceptanceAuthorityStoreInternalV1,
};

/** Production opener: its root is fixed by trusted OS account information. */
export function openProviderAcceptanceAuthorityStoreCandidateInternalV1(): Promise<ProviderAcceptanceAuthorityStoreInternalV1> {
  return openProviderAcceptanceAuthorityStoreWithLayoutCoreInternalV1(
    resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
  );
}
