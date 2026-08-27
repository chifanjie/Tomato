/**
 * Runtime-private authority seam for a same-socket strong mutation session.
 *
 * Neither a wire grant nor a structurally compatible object has authority.
 * Only a verifier registered in the private WeakMap can mint a server-local
 * one-shot session capability, and that capability is deleted before use.
 */

import {
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcPrincipalAttestationV1,
  type ProviderRuntimeIpcStrongMutationRequestV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ContentDigestV1Schema,
  type ContentDigestV1,
  type DurableObjectIdentityProviderIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  ProviderAcceptanceGenerationPinV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  type ProviderAcceptanceGenerationPinV1,
  type ProviderAcceptanceStateEnvelopeV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";

declare const providerRuntimeStrongMutationAuthorityVerifierBrandV1:
  unique symbol;
export interface ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1 {
  readonly [providerRuntimeStrongMutationAuthorityVerifierBrandV1]: true;
}

declare const providerRuntimeStrongMutationSessionBrandV1: unique symbol;
export interface ProviderRuntimeStrongMutationSessionCapabilityInternalV1 {
  readonly [providerRuntimeStrongMutationSessionBrandV1]: true;
}

declare const providerRuntimeStrongMutationExecutionAuthorizationBrandV1:
  unique symbol;
export interface ProviderRuntimeStrongMutationExecutionAuthorizationInternalV1 {
  readonly [providerRuntimeStrongMutationExecutionAuthorizationBrandV1]: true;
}

export type ProviderRuntimeStrongMutationGrantDecisionInternalV1 = Readonly<
  | {
      readonly disposition: "execute" | "recover";
      readonly activateExecutionAuthorization?:
        () => boolean | Promise<boolean>;
    }
  | {
      readonly disposition: "resolved";
      readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
    }
>;

export interface ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1 {
  /** Exact parsed wire request; the durable broker binds and records these bytes. */
  readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly capabilityDigest: ContentDigestV1;
  readonly principalAttestationDigest: ContentDigestV1;
  readonly bindingDigest: ContentDigestV1;
  readonly operation:
    ProviderRuntimeIpcStrongMutationRequestV1["operation"];
  readonly operationNonce: string;
  readonly requestDigest: ContentDigestV1;
  readonly authorityGrant:
    ProviderRuntimeIpcStrongMutationRequestV1["authorityGrant"];
  readonly journalHead: Readonly<{
    readonly revision: number;
    readonly phase: string;
    readonly mutationDigest: ContentDigestV1 | "none";
  }>;
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
  /** Live challenge transcript; omitted only for durable prepared recovery. */
  readonly principalAttestation?: ProviderRuntimeIpcPrincipalAttestationV1;
}

export interface ProviderRuntimeFormalAcceptanceBindingInternalV1 {
  readonly envelope: ProviderAcceptanceStateEnvelopeV1;
  readonly pin: ProviderAcceptanceGenerationPinV1;
}

export interface MintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1Input {
  /**
   * Lazy, authenticated root-authority read. It is deliberately retained only
   * behind the opaque verifier and is never caller/path/env supplied.
   */
  readonly readCurrentFormalAcceptance?: () =>
    | ProviderRuntimeFormalAcceptanceBindingInternalV1
    | false
    | Promise<ProviderRuntimeFormalAcceptanceBindingInternalV1 | false>;
  /**
   * Atomically validate and durably consume the external grant. The injected
   * authoritative store must reject replay across calls and process restarts;
   * true means that persistent consume committed. The local pending set only
   * coalesces concurrent attempts and is not a replay ledger.
   */
  readonly consumeGrant: (
    context: ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1,
  ) =>
    | boolean
    | ProviderRuntimeStrongMutationGrantDecisionInternalV1
    | Promise<boolean | ProviderRuntimeStrongMutationGrantDecisionInternalV1>;
  /**
   * Persist the exact principal-signed terminal response before it is exposed
   * to the caller.  Production authority composition must provide this hook so
   * a durable pending intent can be closed (or safely replayed after a crash).
   * It is optional only for the pre-existing locked/test verifier seam.
   */
  readonly resolveGrant?: (
    resolution: ProviderRuntimeStrongMutationAuthorityGrantResolutionInternalV1,
  ) => boolean | Promise<boolean>;
  /** Read-only proof against the verified, append-ordered legacy broker history. */
  readonly inspectLegacyOutcomeAuthority?: (
    inspection: ProviderRuntimeStrongMutationLegacyOutcomeInspectionInternalV1,
  ) =>
    | ProviderRuntimeStrongMutationLegacyOutcomeAuthorityInternalV1
    | false
    | Promise<
        ProviderRuntimeStrongMutationLegacyOutcomeAuthorityInternalV1 | false
      >;
}

export interface ProviderRuntimeStrongMutationAuthorityGrantResolutionInternalV1 {
  readonly context: ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1;
  readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
}

export interface ProviderRuntimeStrongMutationLegacyOutcomeInspectionInternalV1 {
  readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
  readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
}

export interface ProviderRuntimeStrongMutationLegacyOutcomeAuthorityInternalV1 {
  readonly intentOrdinal: number;
  readonly firstIntentOrdinal: number;
  readonly firstBindingDigest: ContentDigestV1;
}

interface ProviderRuntimeStrongMutationAuthorityVerifierStateInternalV1 {
  readonly consumeGrant:
    MintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1Input["consumeGrant"];
  readonly pendingBindings: Set<ContentDigestV1>;
  readonly resolveGrant:
    | MintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1Input["resolveGrant"]
    | undefined;
  readonly inspectLegacyOutcomeAuthority:
    | MintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1Input["inspectLegacyOutcomeAuthority"]
    | undefined;
  readonly readCurrentFormalAcceptance:
    | MintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1Input["readCurrentFormalAcceptance"]
    | undefined;
}

interface ProviderRuntimeStrongMutationSessionStateInternalV1 {
  readonly bindingDigest: ContentDigestV1;
  readonly context: ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1;
  readonly resolveGrant:
    | MintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1Input["resolveGrant"]
    | undefined;
  readonly decision: ProviderRuntimeStrongMutationGrantDecisionInternalV1;
  executionAuthorization?:
    ProviderRuntimeStrongMutationExecutionAuthorizationInternalV1;
  phase: "issued" | "authorized" | "executing";
}

interface ProviderRuntimeStrongMutationExecutionAuthorizationStateInternalV1 {
  readonly bindingDigest: ContentDigestV1;
  readonly requestDigest: ContentDigestV1;
  readonly disposition: "execute" | "recover";
}

const verifierStatesV1 = new WeakMap<
  object,
  ProviderRuntimeStrongMutationAuthorityVerifierStateInternalV1
>();
const sessionStatesV1 = new WeakMap<
  object,
  ProviderRuntimeStrongMutationSessionStateInternalV1
>();
const executionAuthorizationStatesV1 = new WeakMap<
  object,
  ProviderRuntimeStrongMutationExecutionAuthorizationStateInternalV1
>();

function deepFreezeParsedJsonV1<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreezeParsedJsonV1(nested);
  return Object.freeze(value);
}

function parseDecisionV1(
  value: boolean | ProviderRuntimeStrongMutationGrantDecisionInternalV1,
): ProviderRuntimeStrongMutationGrantDecisionInternalV1 | undefined {
  if (value === true) return Object.freeze({ disposition: "execute" as const });
  if (value === false || typeof value !== "object" || value === null) {
    return undefined;
  }
  if (value.disposition === "execute" || value.disposition === "recover") {
    if (
      value.activateExecutionAuthorization !== undefined &&
      typeof value.activateExecutionAuthorization !== "function"
    ) return undefined;
    return Object.freeze({
      disposition: value.disposition,
      ...(value.activateExecutionAuthorization === undefined
        ? {}
        : {
            activateExecutionAuthorization:
              value.activateExecutionAuthorization,
          }),
    });
  }
  if (value.disposition === "resolved") {
    try {
      return Object.freeze({
        disposition: "resolved" as const,
        response: ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
          structuredClone(value.response),
        ),
      });
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function freezeGrantContextV1(
  context: ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1,
): ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1 {
  const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
    structuredClone(context.request),
  );
  return Object.freeze({
    ...context,
    request: Object.freeze(request),
    journalHead: Object.freeze({ ...context.journalHead }),
    acceptanceIdentity: Object.freeze({ ...context.acceptanceIdentity }),
  });
}

/** Internal registration seam; it is intentionally absent from package exports. */
export function mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1(
  input: MintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1Input,
): ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1 {
  if (
    typeof input.consumeGrant !== "function" ||
    (input.resolveGrant !== undefined && typeof input.resolveGrant !== "function") ||
    (input.inspectLegacyOutcomeAuthority !== undefined &&
      typeof input.inspectLegacyOutcomeAuthority !== "function") ||
    (input.readCurrentFormalAcceptance !== undefined &&
      typeof input.readCurrentFormalAcceptance !== "function")
  ) {
    throw new TypeError("strong mutation authority verifier is invalid");
  }
  const capability = Object.freeze(Object.create(null)) as
    ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1;
  verifierStatesV1.set(capability, {
    consumeGrant: input.consumeGrant,
    pendingBindings: new Set(),
    resolveGrant: input.resolveGrant,
    inspectLegacyOutcomeAuthority: input.inspectLegacyOutcomeAuthority,
    readCurrentFormalAcceptance: input.readCurrentFormalAcceptance,
  });
  return capability;
}

/** Resolve a fresh formal Acceptance only through the registered root broker. */
export async function resolveProviderRuntimeCurrentFormalAcceptanceInternalV1(
  verifier:
    ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1,
): Promise<ProviderRuntimeFormalAcceptanceBindingInternalV1 | undefined> {
  const read = verifierStatesV1.get(verifier as object)
    ?.readCurrentFormalAcceptance;
  if (read === undefined) return undefined;
  try {
    const result = await read();
    if (result === false) return undefined;
    const envelope = ProviderAcceptanceStateEnvelopeV1Schema.parse(
      structuredClone(result.envelope),
    );
    const pin = ProviderAcceptanceGenerationPinV1Schema.parse(
      structuredClone(result.pin),
    );
    if (
      pin.generationId !== envelope.generationId ||
      pin.contentDigest !== envelope.contentDigest ||
      pin.acceptanceOrdinal !== envelope.payload.acceptanceOrdinal
    ) return undefined;
    return Object.freeze({
      envelope: deepFreezeParsedJsonV1(envelope),
      pin: deepFreezeParsedJsonV1(pin),
    });
  } catch {
    return undefined;
  }
}

/**
 * Distinguish an unavailable registered resolver from the older internal
 * verifier seam that predates formal Acceptance reads. Production broker
 * verifiers always register the resolver; a registered resolver returning no
 * binding must therefore fail closed and must never fall back to reference
 * Acceptance.
 */
export function hasProviderRuntimeCurrentFormalAcceptanceResolverInternalV1(
  verifier:
    ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1,
): boolean {
  return verifierStatesV1.get(verifier as object)
    ?.readCurrentFormalAcceptance !== undefined;
}

/** Read-only proof of one retained HEAD outcome against broker history. */
export async function inspectProviderRuntimeStrongMutationLegacyOutcomeAuthorityInternalV1(
  verifier:
    ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1,
  inspection: ProviderRuntimeStrongMutationLegacyOutcomeInspectionInternalV1,
): Promise<
  ProviderRuntimeStrongMutationLegacyOutcomeAuthorityInternalV1 | undefined
> {
  const inspect = verifierStatesV1.get(verifier as object)
    ?.inspectLegacyOutcomeAuthority;
  if (inspect === undefined) return undefined;
  let result:
    | ProviderRuntimeStrongMutationLegacyOutcomeAuthorityInternalV1
    | false;
  try {
    result = await inspect(Object.freeze({
      request: ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
        structuredClone(inspection.request),
      ),
      response: ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        structuredClone(inspection.response),
      ),
    }));
  } catch {
    return undefined;
  }
  if (
    result === false ||
    !Number.isSafeInteger(result.intentOrdinal) ||
    result.intentOrdinal < 1 ||
    !Number.isSafeInteger(result.firstIntentOrdinal) ||
    result.firstIntentOrdinal < 1 ||
    result.firstIntentOrdinal > result.intentOrdinal
  ) return undefined;
  let firstBindingDigest: ContentDigestV1;
  try {
    firstBindingDigest = ContentDigestV1Schema.parse(result.firstBindingDigest);
  } catch {
    return undefined;
  }
  return Object.freeze({
    intentOrdinal: result.intentOrdinal,
    firstIntentOrdinal: result.firstIntentOrdinal,
    firstBindingDigest,
  });
}

/** Atomically consume a grant and mint a process-local, one-shot capability. */
export async function consumeProviderRuntimeStrongMutationAuthorityGrantInternalV1(
  verifier:
    ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1,
  context: ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1,
): Promise<
  ProviderRuntimeStrongMutationSessionCapabilityInternalV1 | undefined
> {
  const state = verifierStatesV1.get(verifier as object);
  if (
    state === undefined ||
    state.pendingBindings.has(context.bindingDigest)
  ) {
    return undefined;
  }
  state.pendingBindings.add(context.bindingDigest);
  let consumed:
    | boolean
    | ProviderRuntimeStrongMutationGrantDecisionInternalV1 = false;
  try {
    consumed = await state.consumeGrant(freezeGrantContextV1(context));
  } catch {
    return undefined;
  } finally {
    state.pendingBindings.delete(context.bindingDigest);
  }
  const decision = parseDecisionV1(consumed);
  if (decision === undefined) return undefined;
  const capability = Object.freeze(Object.create(null)) as
    ProviderRuntimeStrongMutationSessionCapabilityInternalV1;
  sessionStatesV1.set(capability, {
    bindingDigest: context.bindingDigest,
    context: freezeGrantContextV1(context),
    resolveGrant: state.resolveGrant,
    decision,
    phase: "issued",
  });
  return capability;
}

/** Authorize exactly once; copied or reused handles always fail. */
export function consumeProviderRuntimeStrongMutationSessionCapabilityInternalV1(
  capability: ProviderRuntimeStrongMutationSessionCapabilityInternalV1,
  expectedBindingDigest: ContentDigestV1,
): boolean {
  const state = sessionStatesV1.get(capability as object);
  if (
    state === undefined ||
    state.phase !== "issued" ||
    state.bindingDigest !== expectedBindingDigest
  ) {
    return false;
  }
  state.phase = "authorized";
  return true;
}

/**
 * Transfers the broker-bound one-shot authority into the storage operation.
 * A boolean admission result can no longer be used as execution authority.
 */
export async function takeProviderRuntimeStrongMutationExecutionAuthorizationInternalV1(
  capability: ProviderRuntimeStrongMutationSessionCapabilityInternalV1,
  expectedBindingDigest: ContentDigestV1,
): Promise<Readonly<{
  readonly decision: ProviderRuntimeStrongMutationGrantDecisionInternalV1;
  readonly authorization?:
    ProviderRuntimeStrongMutationExecutionAuthorizationInternalV1;
}> | undefined> {
  const state = sessionStatesV1.get(capability as object);
  if (
    state === undefined ||
    state.phase !== "authorized" ||
    state.bindingDigest !== expectedBindingDigest
  ) return undefined;
  if (
    state.decision.disposition !== "resolved" &&
    state.decision.activateExecutionAuthorization !== undefined
  ) {
    try {
      if (await state.decision.activateExecutionAuthorization() !== true) {
        return undefined;
      }
    } catch {
      return undefined;
    }
  }
  let executionAuthorization:
    | ProviderRuntimeStrongMutationExecutionAuthorizationInternalV1
    | undefined;
  if (state.decision.disposition !== "resolved") {
    executionAuthorization = Object.freeze(Object.create(null)) as
      ProviderRuntimeStrongMutationExecutionAuthorizationInternalV1;
    executionAuthorizationStatesV1.set(executionAuthorization, {
      bindingDigest: state.bindingDigest,
      requestDigest: state.context.requestDigest,
      disposition: state.decision.disposition,
    });
  }
  state.executionAuthorization = executionAuthorization;
  state.phase = "executing";
  return Object.freeze({
    decision: state.decision,
    ...(state.executionAuthorization === undefined
      ? {}
      : { authorization: state.executionAuthorization }),
  });
}

/** Delete-before-return exact consume at the first durable execution step. */
export function consumeProviderRuntimeStrongMutationExecutionAuthorizationInternalV1(
  authorization:
    ProviderRuntimeStrongMutationExecutionAuthorizationInternalV1,
  expected: Readonly<{
    readonly bindingDigest: ContentDigestV1;
    readonly requestDigest: ContentDigestV1;
    readonly disposition: "execute" | "recover";
  }>,
): boolean {
  const state = executionAuthorizationStatesV1.get(authorization as object);
  executionAuthorizationStatesV1.delete(authorization as object);
  return state !== undefined &&
    state.bindingDigest === expected.bindingDigest &&
    state.requestDigest === expected.requestDigest &&
    state.disposition === expected.disposition;
}

/**
 * Delete-before-callback terminal resolution.  A failed callback leaves the
 * external broker's durable pending record authoritative and this local
 * capability unusable.  Recovery must close that exact intent from retained
 * signed/native execution evidence; it must not authorize another execution.
 */
export async function resolveProviderRuntimeStrongMutationSessionCapabilityInternalV1(
  capability: ProviderRuntimeStrongMutationSessionCapabilityInternalV1,
  expectedBindingDigest: ContentDigestV1,
  response: ProviderRuntimeIpcStrongMutationResponseV1,
): Promise<boolean> {
  const state = sessionStatesV1.get(capability as object);
  sessionStatesV1.delete(capability as object);
  if (
    state === undefined ||
    (state.phase !== "authorized" && state.phase !== "executing") ||
    state.bindingDigest !== expectedBindingDigest
  ) {
    return false;
  }
  if (state.resolveGrant === undefined) return true;
  try {
    return await state.resolveGrant(Object.freeze({
      context: state.context,
      response,
    })) === true;
  } catch {
    return false;
  }
}
