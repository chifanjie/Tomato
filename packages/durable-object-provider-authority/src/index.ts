import {
  inspectProviderAcceptanceAuthorityCandidateWithLayoutCoreInternalV1,
  type ProviderAcceptanceAuthorityDoctorResultInternalV1,
} from "./acceptance-store-core-internal.js";
import {
  ProviderAcceptanceAuthorityErrorV1,
  isProviderAcceptanceAuthorityErrorV1,
  type ProviderAcceptanceAuthorityErrorCodeV1,
} from "./errors.js";
import {
  PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1,
  resolveProviderAcceptanceAuthorityProductionLayoutInternalV1,
} from "./platform-layout.js";

export {
  PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1,
  ProviderAcceptanceAuthorityErrorV1,
  isProviderAcceptanceAuthorityErrorV1,
};
export type { ProviderAcceptanceAuthorityErrorCodeV1 };

export const PROVIDER_ACCEPTANCE_AUTHORITY_CANDIDATE_STATUS_V1 = Object.freeze({
  authority: "installation_owner_candidate" as const,
  strongWrites: "locked" as const,
});

/** Public, path-redacted health projection; it cannot append or mint tokens. */
export async function inspectProviderAcceptanceAuthorityCandidateV1(): Promise<ProviderAcceptanceAuthorityDoctorResultInternalV1> {
  try {
    return inspectProviderAcceptanceAuthorityCandidateWithLayoutCoreInternalV1(
      resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
    );
  } catch {
    return Object.freeze({
      status: "integrity_failed" as const,
      authority: "installation_owner_candidate" as const,
      strongWrites: "locked" as const,
      namespace: "unavailable" as const,
    });
  }
}
