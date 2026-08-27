import { createHash } from "node:crypto";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcPrincipalAttestationV1,
  type ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
  type ProviderRuntimeIpcStrongMutationRequestV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  type ContentDigestV1,
  type DurableObjectIdentityProviderIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";

import {
  assertProviderStrongMutationBrokerStoreCapabilityInternalV1,
  type ProviderStrongMutationBrokerLegacyOutcomeAuthorityInternalV1,
  type ProviderStrongMutationBrokerStoreInternalV1,
} from "./strong-mutation-broker-core-internal.js";
import {
  consumeProviderStrongMutationExecutionLeaseInternalV1,
} from "./strong-mutation-execution-fence-internal.js";

export interface ProviderStrongMutationProductionGrantContextInternalV1 {
  readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly capabilityDigest: ContentDigestV1;
  readonly principalAttestationDigest: ContentDigestV1;
  readonly bindingDigest: ContentDigestV1;
  readonly operation: ProviderRuntimeIpcStrongMutationRequestV1["operation"];
  readonly operationNonce: string;
  readonly requestDigest: ContentDigestV1;
  readonly authorityGrant:
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1;
  readonly journalHead: Readonly<{
    readonly revision: number;
    readonly phase: string;
    readonly mutationDigest: ContentDigestV1 | "none";
  }>;
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
  /** Present for a live begin; recovery reuses the broker's durable copy. */
  readonly principalAttestation?: ProviderRuntimeIpcPrincipalAttestationV1;
}

export interface ProviderStrongMutationProductionGrantResolutionInternalV1 {
  readonly context: ProviderStrongMutationProductionGrantContextInternalV1;
  readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
}

export interface ProviderStrongMutationProductionSessionCallbacksInternalV1 {
  readonly profile:
    "provider_strong_mutation_production_session_callbacks_v1";
  readonly executionFence:
    "established_linux_ext4_exact_object_dedicated_os_principal_v1";
  readonly strongWrites: "unlocked";
  readonly consumeGrant: (
    context: ProviderStrongMutationProductionGrantContextInternalV1,
  ) => Promise<ProviderStrongMutationProductionGrantDecisionInternalV1 | false>;
  readonly resolveGrant: (
    resolution: ProviderStrongMutationProductionGrantResolutionInternalV1,
  ) => Promise<boolean>;
  readonly inspectLegacyOutcomeAuthority: (
    inspection: Readonly<{
      readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
      readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
    }>,
  ) => Promise<ProviderStrongMutationBrokerLegacyOutcomeAuthorityInternalV1 | false>;
}

export type ProviderStrongMutationProductionGrantDecisionInternalV1 =
  Readonly<
    | {
        readonly disposition: "recover";
        readonly activateExecutionAuthorization: () => Promise<boolean>;
      }
    | {
        readonly disposition: "execute";
        readonly activateExecutionAuthorization: () => Promise<boolean>;
      }
    | {
        readonly disposition: "resolved";
        readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
      }
  >;

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  try {
    return canonicalizeJcsSafeIntegerV1(left) ===
      canonicalizeJcsSafeIntegerV1(right);
  } catch {
    return false;
  }
}

function exactAcceptanceV1(
  left: ProviderRuntimeIpcAcceptanceIdentityProofV1,
  right: ProviderRuntimeIpcAcceptanceIdentityProofV1,
): boolean {
  return left.generationId === right.generationId &&
    left.contentDigest === right.contentDigest &&
    left.acceptanceOrdinal === right.acceptanceOrdinal &&
    left.installationIdentityGenerationId ===
      right.installationIdentityGenerationId;
}

function parseExactContextV1(
  input: ProviderStrongMutationProductionGrantContextInternalV1,
): Readonly<{
  readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
  readonly principalAttestation?: ProviderRuntimeIpcPrincipalAttestationV1;
}> {
  const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
    input.request,
  );
  const acceptanceIdentity =
    ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse(
      input.acceptanceIdentity,
    );
  const providerId = DurableObjectIdentityProviderIdV1Schema.parse(
    input.providerId,
  );
  const capabilityDigest = ContentDigestV1Schema.parse(input.capabilityDigest);
  const principalAttestationDigest = ContentDigestV1Schema.parse(
    input.principalAttestationDigest,
  );
  const bindingDigest = ContentDigestV1Schema.parse(input.bindingDigest);
  const requestDigest = ContentDigestV1Schema.parse(input.requestDigest);
  const grant = request.authorityGrant.payload;
  const principalAttestation = input.principalAttestation === undefined
    ? undefined
    : ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(
        input.principalAttestation,
      );
  if (
    providerId !== grant.providerId ||
    capabilityDigest !== grant.capabilityDigest ||
    principalAttestationDigest !== request.principalAttestationDigest ||
    principalAttestationDigest !== grant.principalAttestationDigest ||
    bindingDigest !== request.bindingDigest ||
    input.operation !== request.operation ||
    input.operation !== grant.operation ||
    input.operationNonce !== request.operationNonce ||
    input.operationNonce !== grant.operationNonce ||
    requestDigest !== request.requestDigest ||
    requestDigest !== grant.requestDigest ||
    !canonicalEqualV1(input.authorityGrant, request.authorityGrant) ||
    input.journalHead.revision !== grant.journalHead.revision ||
    input.journalHead.phase !== grant.journalHead.phase ||
    input.journalHead.mutationDigest !== grant.journalHead.mutationDigest ||
    !exactAcceptanceV1(acceptanceIdentity, grant.acceptanceIdentity) ||
    (principalAttestation !== undefined &&
      `sha256:${createHash("sha256").update(
        canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1(
          principalAttestation,
        ),
      ).digest("hex")}` !== principalAttestationDigest)
  ) {
    throw new TypeError("provider production grant context is invalid");
  }
  return Object.freeze({
    request,
    acceptanceIdentity,
    ...(principalAttestation === undefined ? {} : { principalAttestation }),
  });
}

function exactResponseContextV1(
  response: ProviderRuntimeIpcStrongMutationResponseV1,
  request: ProviderRuntimeIpcStrongMutationRequestV1,
): boolean {
  return response.requestId === request.requestId &&
    response.principalAttestationDigest === request.principalAttestationDigest &&
    response.bindingDigest === request.bindingDigest &&
    response.operation === request.operation &&
    response.operationNonce === request.operationNonce &&
    response.requestDigest === request.requestDigest;
}

/**
 * Adapt one authenticated, execution-fenced broker into the runtime-private
 * begin/resolve callbacks. A structural fake broker, a locked broker, a
 * mismatched replay, or a resolved request presented for fresh execution all
 * fail closed.
 */
export function createProviderStrongMutationProductionSessionCallbacksInternalV1(
  broker: ProviderStrongMutationBrokerStoreInternalV1,
): ProviderStrongMutationProductionSessionCallbacksInternalV1 {
  assertProviderStrongMutationBrokerStoreCapabilityInternalV1(broker);
  if (
    broker.executionFence !==
      "established_linux_ext4_exact_object_dedicated_os_principal_v1" ||
    broker.strongWrites !== "unlocked"
  ) {
    throw new TypeError("provider production execution fence is unavailable");
  }

  const consumeGrant = async (
    context: ProviderStrongMutationProductionGrantContextInternalV1,
  ): Promise<ProviderStrongMutationProductionGrantDecisionInternalV1 | false> => {
    try {
      const parsed = parseExactContextV1(context);
      const result = await broker.begin(
        parsed.request,
        parsed.principalAttestation,
      );
      if (
        result.resolution !== "recorded" ||
        result.intent.strongWrites !== "unlocked" ||
        exactAcceptanceV1(
          result.intent.acceptanceIdentity,
          parsed.acceptanceIdentity,
        ) !== true ||
        !canonicalEqualV1(result.intent.request, parsed.request)
      ) return false;
      if (
        result.intent.executionFence !==
          "established_linux_ext4_exact_object_dedicated_os_principal_v1"
      ) return false;
      if (result.intent.state === "resolved") {
        return Object.freeze({
          disposition: "resolved" as const,
          response: result.intent.response,
        });
      }
      const executionAuthorization = result.executionAuthorization;
      if (executionAuthorization === undefined) return false;
      return Object.freeze({
        disposition: result.disposition === "created"
          ? "execute" as const
          : "recover" as const,
        activateExecutionAuthorization: () =>
          consumeProviderStrongMutationExecutionLeaseInternalV1(
            executionAuthorization,
            {
              bindingDigest: parsed.request.bindingDigest,
              requestDigest: parsed.request.requestDigest,
            },
          ),
      });
    } catch {
      return false;
    }
  };

  const resolveGrant = async (
    resolution: ProviderStrongMutationProductionGrantResolutionInternalV1,
  ): Promise<boolean> => {
    try {
      const parsed = parseExactContextV1(resolution.context);
      const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        resolution.response,
      );
      if (!exactResponseContextV1(response, parsed.request)) return false;
      // Re-open the durable intent instead of trusting process-local state;
      // this is the recovery path after a broker/service restart.
      const begun = await broker.begin(parsed.request);
      if (
        begun.resolution !== "recorded" ||
        begun.intent.executionFence !==
          "established_linux_ext4_exact_object_dedicated_os_principal_v1" ||
        begun.intent.strongWrites !== "unlocked"
      ) return false;
      const result = await broker.resolve({
        profile: "provider_strong_mutation_broker_resolve_request_v1",
        grantId: begun.intent.grantId,
        requestContentDigest: begun.intent.requestContentDigest,
        requestDigest: begun.intent.requestDigest,
        bindingDigest: begun.intent.bindingDigest,
        response,
      });
      return result.resolution === "resolved" &&
        result.intent.executionFence ===
          "established_linux_ext4_exact_object_dedicated_os_principal_v1" &&
        result.intent.strongWrites === "unlocked" &&
        canonicalEqualV1(result.intent.response, response);
    } catch {
      return false;
    }
  };

  const inspectLegacyOutcomeAuthority = async (
    inspection: Readonly<{
      readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
      readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
    }>,
  ): Promise<ProviderStrongMutationBrokerLegacyOutcomeAuthorityInternalV1 | false> => {
    try {
      const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
        inspection.request,
      );
      const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        inspection.response,
      );
      if (!exactResponseContextV1(response, request)) return false;
      return await broker.inspectLegacyOutcomeAuthority({ request, response });
    } catch {
      return false;
    }
  };

  return Object.freeze({
    profile: "provider_strong_mutation_production_session_callbacks_v1" as const,
    executionFence:
      "established_linux_ext4_exact_object_dedicated_os_principal_v1" as const,
    strongWrites: "unlocked" as const,
    consumeGrant,
    resolveGrant,
    inspectLegacyOutcomeAuthority,
  });
}
