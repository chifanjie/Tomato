/**
 * Runtime-private authority seam for a same-socket strong mutation session.
 *
 * Neither a wire grant nor a structurally compatible object has authority.
 * Only a verifier registered in the private WeakMap can mint a server-local
 * one-shot session capability, and that capability is deleted before use.
 */

import type {
  ProviderRuntimeIpcAcceptanceIdentityProofV1,
  ProviderRuntimeIpcStrongMutationRequestV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import type {
  ContentDigestV1,
  DurableObjectIdentityProviderIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";

declare const providerRuntimeStrongMutationAuthorityVerifierBrandV1:
  unique symbol;
export interface ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1 {
  readonly [providerRuntimeStrongMutationAuthorityVerifierBrandV1]: true;
}

declare const providerRuntimeStrongMutationSessionBrandV1: unique symbol;
export interface ProviderRuntimeStrongMutationSessionCapabilityInternalV1 {
  readonly [providerRuntimeStrongMutationSessionBrandV1]: true;
}

export interface ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1 {
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly capabilityDigest: ContentDigestV1;
  readonly principalAttestationDigest: ContentDigestV1;
  readonly bindingDigest: ContentDigestV1;
  readonly operation:
    ProviderRuntimeIpcStrongMutationRequestV1["operation"];
  readonly operationNonce: string;
  readonly requestDigest: ContentDigestV1;
  readonly authorityGrant: string;
  readonly journalHead: Readonly<{
    readonly revision: number;
    readonly phase: string;
    readonly mutationDigest: ContentDigestV1 | "none";
  }>;
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
}

export interface MintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1Input {
  /**
   * Atomically validate and durably consume the external grant. The injected
   * authoritative store must reject replay across calls and process restarts;
   * true means that persistent consume committed. The local pending set only
   * coalesces concurrent attempts and is not a replay ledger.
   */
  readonly consumeGrant: (
    context: ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1,
  ) => boolean | Promise<boolean>;
}

interface ProviderRuntimeStrongMutationAuthorityVerifierStateInternalV1 {
  readonly consumeGrant:
    MintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1Input["consumeGrant"];
  readonly pendingBindings: Set<ContentDigestV1>;
}

const verifierStatesV1 = new WeakMap<
  object,
  ProviderRuntimeStrongMutationAuthorityVerifierStateInternalV1
>();
const sessionStatesV1 = new WeakMap<object, ContentDigestV1>();

/** Internal registration seam; it is intentionally absent from package exports. */
export function mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1(
  input: MintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1Input,
): ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1 {
  if (typeof input.consumeGrant !== "function") {
    throw new TypeError("strong mutation authority verifier is invalid");
  }
  const capability = Object.freeze(Object.create(null)) as
    ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1;
  verifierStatesV1.set(capability, {
    consumeGrant: input.consumeGrant,
    pendingBindings: new Set(),
  });
  return capability;
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
  let consumed = false;
  try {
    consumed = await state.consumeGrant(
      Object.freeze({
        ...context,
        journalHead: Object.freeze({ ...context.journalHead }),
        acceptanceIdentity: Object.freeze({
          ...context.acceptanceIdentity,
        }),
      }),
    );
  } catch {
    return undefined;
  } finally {
    state.pendingBindings.delete(context.bindingDigest);
  }
  if (consumed !== true) return undefined;
  const capability = Object.freeze(Object.create(null)) as
    ProviderRuntimeStrongMutationSessionCapabilityInternalV1;
  sessionStatesV1.set(capability, context.bindingDigest);
  return capability;
}

/** Delete-before-return consumption; copied or reused handles always fail. */
export function consumeProviderRuntimeStrongMutationSessionCapabilityInternalV1(
  capability: ProviderRuntimeStrongMutationSessionCapabilityInternalV1,
  expectedBindingDigest: ContentDigestV1,
): boolean {
  const state = sessionStatesV1.get(capability as object);
  sessionStatesV1.delete(capability as object);
  return state === expectedBindingDigest;
}
