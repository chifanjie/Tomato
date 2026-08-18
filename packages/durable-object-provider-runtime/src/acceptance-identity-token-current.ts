import {
  ProviderRuntimeIpcJournalStateV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-reference-candidate";

import {
  diagnoseProviderRuntimeDurableAcceptanceCurrentV1,
  type ProviderRuntimeDurableAcceptanceCurrentCandidateV1,
  type VerifyProviderRuntimeDurableAcceptanceCurrentOptionsV1,
} from "./durable-acceptance-current.js";
import { inspectProviderRuntimeAuthenticatedJournalStateV1 } from "./live-service-readiness.js";

export const PROVIDER_RUNTIME_ACCEPTANCE_IDENTITY_TOKEN_REQUIRED_NEXT_V1 =
  "kernel_os_peer_gate" as const;

export type ProviderRuntimeAcceptanceIdentityVerificationCapabilityV1 =
  Parameters<
    typeof verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1
  >[0];

export interface VerifyProviderRuntimeAcceptanceIdentityTokenCurrentOptionsV1
  extends VerifyProviderRuntimeDurableAcceptanceCurrentOptionsV1 {
  /** Opaque capability minted and retained by the Installation Identity owner. */
  readonly identityVerificationCapability:
    ProviderRuntimeAcceptanceIdentityVerificationCapabilityV1;
}

export interface ProviderRuntimeAcceptanceIdentityTokenCurrentCandidateV1 {
  readonly status: "acceptance_identity_token_current_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly acceptanceTokenStatus:
    "verified_with_installation_identity_capability";
  readonly requiredNext:
    typeof PROVIDER_RUNTIME_ACCEPTANCE_IDENTITY_TOKEN_REQUIRED_NEXT_V1;
  readonly durableAcceptance:
    ProviderRuntimeDurableAcceptanceCurrentCandidateV1;
  readonly bindings:
    ProviderRuntimeDurableAcceptanceCurrentCandidateV1["bindings"];
}

export type ProviderRuntimeAcceptanceIdentityTokenCurrentDiagnosticV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderRuntimeAcceptanceIdentityTokenCurrentCandidateV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
      readonly stage:
        | "durable_acceptance_current"
        | "acceptance_identity_token";
    }>;

function unavailableV1(
  stage: Extract<
    ProviderRuntimeAcceptanceIdentityTokenCurrentDiagnosticV1,
    { readonly ok: false }
  >["stage"],
): ProviderRuntimeAcceptanceIdentityTokenCurrentDiagnosticV1 {
  return Object.freeze({
    ok: false as const,
    code: "provider_unavailable" as const,
    reason: "attestation_invalid" as const,
    stage,
  });
}

function exactStoredAcceptanceEnvelopeV1(
  stateInput: unknown,
  durable:
    ProviderRuntimeDurableAcceptanceCurrentCandidateV1,
) {
  const state = ProviderRuntimeIpcJournalStateV1Schema.parse(stateInput);
  if (
    state.phase !== "final_strong_ready" ||
    state.revision !== durable.bindings.journalRevision ||
    state.mutationDigest !== durable.bindings.journalMutationDigest
  ) {
    throw new TypeError("durable Acceptance observation changed");
  }
  const artifacts = state.artifacts as Record<string, unknown>;
  const closure = artifacts.finalStrongReadyAcceptance;
  if (
    closure === null ||
    typeof closure !== "object" ||
    Array.isArray(closure)
  ) {
    throw new TypeError("final Acceptance closure is unavailable");
  }
  const envelope =
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse(
      (closure as Record<string, unknown>)
        .finalStrongReadyAcceptanceEnvelope,
    );
  if (
    envelope.installationIdentityGenerationId !==
      durable.bindings.installationIdentityGenerationId ||
    envelope.payload.acceptanceOrdinal !==
      durable.bindings.acceptanceOrdinal ||
    envelope.generationId !== durable.bindings.acceptanceGenerationId ||
    envelope.contentDigest !== durable.bindings.acceptanceContentDigest
  ) {
    throw new TypeError("stored Acceptance does not match durable current");
  }
  return envelope;
}

/**
 * Re-observe the authenticated durable journal and verify its exact current
 * Acceptance token with the Installation Identity owner's opaque capability.
 * A successful result is still read-only and keeps strong writes locked until
 * the independent kernel OS-peer gate succeeds.
 */
export async function diagnoseProviderRuntimeAcceptanceIdentityTokenCurrentV1(
  input: VerifyProviderRuntimeAcceptanceIdentityTokenCurrentOptionsV1,
): Promise<ProviderRuntimeAcceptanceIdentityTokenCurrentDiagnosticV1> {
  const durable =
    await diagnoseProviderRuntimeDurableAcceptanceCurrentV1(input).catch(
      () => undefined,
    );
  if (durable === undefined || !durable.ok) {
    return unavailableV1("durable_acceptance_current");
  }
  try {
    const state = await inspectProviderRuntimeAuthenticatedJournalStateV1({
      config: input.liveGateBinding.config,
      authKey: input.liveGateBinding.authKey,
      expectedInstallationIdentityDigest:
        input.liveGateBinding.expectedInstallationIdentityDigest,
      timeoutMs: input.liveGateBinding.timeoutMs,
    });
    const envelope = exactStoredAcceptanceEnvelopeV1(
      state,
      durable.value,
    );
    const valid =
      await verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1(
        input.identityVerificationCapability,
        envelope,
      );
    if (!valid) return unavailableV1("acceptance_identity_token");
    return Object.freeze({
      ok: true as const,
      value: Object.freeze({
        status: "acceptance_identity_token_current_candidate" as const,
        authority: "none" as const,
        accessMode: "read_only" as const,
        strongWriteStatus: "locked" as const,
        acceptanceTokenStatus:
          "verified_with_installation_identity_capability" as const,
        requiredNext:
          PROVIDER_RUNTIME_ACCEPTANCE_IDENTITY_TOKEN_REQUIRED_NEXT_V1,
        durableAcceptance: durable.value,
        bindings: durable.value.bindings,
      }),
    });
  } catch {
    return unavailableV1("acceptance_identity_token");
  }
}

export const verifyProviderRuntimeAcceptanceIdentityTokenCurrentV1 =
  diagnoseProviderRuntimeAcceptanceIdentityTokenCurrentV1;
