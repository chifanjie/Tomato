import type {
  ProviderMigrationDurableExecutionSummaryV1,
} from "@understand-code/durable-object-provider-contracts/provider-migration-durable-execution";
import {
  ProviderRuntimeIpcJournalStateV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ContentDigestV1Schema,
  type ContentDigestV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderStrongReadyAcceptanceGenerationPinCandidateV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";

import {
  verifyProviderRuntimeLivePrincipalChallengeV1,
  type ProviderRuntimePrincipalKeyLiveCandidateV1,
} from "./live-principal-challenge.js";
import { inspectProviderRuntimeAuthenticatedJournalStateV1 } from "./live-service-readiness.js";
import type { ProviderServiceHandoffConfigV1 } from "./service-handoff.js";

export const PROVIDER_RUNTIME_DURABLE_EXECUTION_PRINCIPAL_HEAD_REQUIRED_NEXT_V1 =
  "acceptance_identity_token_and_kernel_os_peer_gate" as const;

export interface VerifyProviderRuntimeDurableExecutionPrincipalHeadOptionsV1 {
  /** Result returned by the same successful public durable execution call. */
  readonly execution: ProviderMigrationDurableExecutionSummaryV1;
  /** Signed service handoff whose private key must answer the fresh challenge. */
  readonly config: ProviderServiceHandoffConfigV1;
  /** Private IPC key used only to re-read the exact committed Acceptance. */
  readonly authKey: Uint8Array;
  readonly expectedInstallationIdentityDigest?: ContentDigestV1;
  readonly timeoutMs?: number;
}

export interface ProviderRuntimeDurableExecutionPrincipalHeadCandidateV1 {
  readonly status: "durable_execution_principal_head_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly acceptanceTokenStatus: "not_verified";
  readonly kernelPeerStatus: "not_verified";
  readonly requiredNext:
    typeof PROVIDER_RUNTIME_DURABLE_EXECUTION_PRINCIPAL_HEAD_REQUIRED_NEXT_V1;
  readonly bindings: Readonly<{
    readonly providerId: string;
    readonly journalRevision: number;
    readonly journalPhase: "final_strong_ready";
    readonly journalMutationDigest: ContentDigestV1;
    readonly finalStrongReadyAcceptancePin:
      ProviderStrongReadyAcceptanceGenerationPinCandidateV1;
  }>;
  readonly principalKey: ProviderRuntimePrincipalKeyLiveCandidateV1;
}

export type ProviderRuntimeDurableExecutionPrincipalHeadDiagnosticV1 =
  | Readonly<{
      readonly ok: true;
      readonly value: ProviderRuntimeDurableExecutionPrincipalHeadCandidateV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
    }>;

function unavailableV1(): ProviderRuntimeDurableExecutionPrincipalHeadDiagnosticV1 {
  return Object.freeze({
    ok: false as const,
    code: "provider_unavailable" as const,
    reason: "attestation_invalid" as const,
  });
}

function parseExecutionV1(
  value: ProviderMigrationDurableExecutionSummaryV1,
): Readonly<{
  readonly providerId: string;
  readonly revision: number;
  readonly mutationDigest: ContentDigestV1;
  readonly acceptancePin: ProviderStrongReadyAcceptanceGenerationPinCandidateV1;
}> {
  if (
    value?.profile !== "provider_migration_durable_execution_summary_v1" ||
    value.durability !==
      "separate_process_private_filesystem_durable_candidate_v1" ||
    value.osIsolationAuthority !==
      "not_yet_proven_service_principal_v1" ||
    value.strongWriteCapability !==
      "locked_to_verified_runtime_selection_v1" ||
    typeof value.destinationProviderId !== "string" ||
    value.destinationProviderId.length === 0 ||
    !Number.isSafeInteger(value.finalJournalRevision) ||
    value.finalJournalRevision < 1 ||
    value.finalJournalPhase !== "final_strong_ready"
  ) {
    throw new TypeError("durable execution summary is invalid");
  }
  return Object.freeze({
    providerId: value.destinationProviderId,
    revision: value.finalJournalRevision,
    mutationDigest: ContentDigestV1Schema.parse(
      value.finalJournalMutationDigest,
    ),
    acceptancePin:
      ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse(
        value.finalStrongReadyAcceptancePin,
      ),
  });
}

function exactAcceptancePinAtHeadV1(
  stateInput: unknown,
  execution: ReturnType<typeof parseExecutionV1>,
): ProviderStrongReadyAcceptanceGenerationPinCandidateV1 {
  const state = ProviderRuntimeIpcJournalStateV1Schema.parse(stateInput);
  if (
    state.revision !== execution.revision ||
    state.phase !== "final_strong_ready" ||
    state.mutationDigest !== execution.mutationDigest
  ) {
    throw new TypeError("authenticated journal head changed");
  }
  const closure = state.artifacts.finalStrongReadyAcceptance;
  if (
    closure === null ||
    typeof closure !== "object" ||
    Array.isArray(closure)
  ) {
    throw new TypeError("final Acceptance closure is unavailable");
  }
  const closureRecord = closure as Record<string, unknown>;
  const envelope =
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse(
      closureRecord.finalStrongReadyAcceptanceEnvelope,
    );
  const storedPin =
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse(
      closureRecord.finalStrongReadyAcceptancePin,
    );
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1(
    {
      installationIdentityGenerationId:
        envelope.payload.installationIdentityGenerationId,
      acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
      predecessor: envelope.payload.predecessor,
      configuration: envelope.payload.configuration,
    },
  );
  const contentDigest = deriveProviderStrongReadyAcceptanceStateContentDigestV1(
    envelope.payload,
  );
  if (
    envelope.generationId !== generationId ||
    envelope.payload.generationId !== generationId ||
    envelope.contentDigest !== contentDigest ||
    envelope.installationIdentityGenerationId !==
      envelope.payload.installationIdentityGenerationId ||
    envelope.acceptedAt !== envelope.payload.acceptedAt ||
    storedPin.acceptanceOrdinal !== envelope.payload.acceptanceOrdinal ||
    storedPin.generationId !== generationId ||
    storedPin.contentDigest !== contentDigest ||
    storedPin.locatorProfile !== execution.acceptancePin.locatorProfile ||
    storedPin.acceptanceOrdinal !== execution.acceptancePin.acceptanceOrdinal ||
    storedPin.generationId !== execution.acceptancePin.generationId ||
    storedPin.contentDigest !== execution.acceptancePin.contentDigest
  ) {
    throw new TypeError("final Acceptance Pin does not match journal head");
  }
  return storedPin;
}

/**
 * Join a successful public durable execution to the live service key at the
 * exact committed journal head. This does not verify the keyed Acceptance
 * token or kernel peer credentials and therefore cannot unlock strong writes.
 */
export async function diagnoseProviderRuntimeDurableExecutionPrincipalHeadV1(
  input: VerifyProviderRuntimeDurableExecutionPrincipalHeadOptionsV1,
): Promise<ProviderRuntimeDurableExecutionPrincipalHeadDiagnosticV1> {
  try {
    const execution = parseExecutionV1(input.execution);
    const principalKey = await verifyProviderRuntimeLivePrincipalChallengeV1({
      config: input.config,
      expectedJournalRevision: execution.revision,
      expectedJournalPhase: "final_strong_ready",
      expectedJournalMutationDigest: execution.mutationDigest,
      expectedInstallationIdentityDigest:
        input.expectedInstallationIdentityDigest,
      timeoutMs: input.timeoutMs,
    });
    if (
      principalKey.status !== "principal_key_live_candidate" ||
      principalKey.bindings.providerId !== execution.providerId ||
      principalKey.bindings.journalRevision !== execution.revision ||
      principalKey.bindings.journalPhase !== "final_strong_ready" ||
      principalKey.bindings.journalMutationDigest !== execution.mutationDigest
    ) {
      return unavailableV1();
    }
    const authenticatedState =
      await inspectProviderRuntimeAuthenticatedJournalStateV1({
        config: input.config,
        authKey: input.authKey,
        expectedInstallationIdentityDigest:
          input.expectedInstallationIdentityDigest,
        timeoutMs: input.timeoutMs,
      });
    const acceptancePin = exactAcceptancePinAtHeadV1(
      authenticatedState,
      execution,
    );
    return Object.freeze({
      ok: true as const,
      value: Object.freeze({
        status: "durable_execution_principal_head_candidate" as const,
        authority: "none" as const,
        accessMode: "read_only" as const,
        strongWriteStatus: "locked" as const,
        acceptanceTokenStatus: "not_verified" as const,
        kernelPeerStatus: "not_verified" as const,
        requiredNext:
          PROVIDER_RUNTIME_DURABLE_EXECUTION_PRINCIPAL_HEAD_REQUIRED_NEXT_V1,
        bindings: Object.freeze({
          providerId: execution.providerId,
          journalRevision: execution.revision,
          journalPhase: "final_strong_ready" as const,
          journalMutationDigest: execution.mutationDigest,
          finalStrongReadyAcceptancePin: acceptancePin,
        }),
        principalKey,
      }),
    });
  } catch {
    return unavailableV1();
  }
}

export async function verifyProviderRuntimeDurableExecutionPrincipalHeadV1(
  input: VerifyProviderRuntimeDurableExecutionPrincipalHeadOptionsV1,
): Promise<ProviderRuntimeDurableExecutionPrincipalHeadDiagnosticV1> {
  return diagnoseProviderRuntimeDurableExecutionPrincipalHeadV1(input);
}
