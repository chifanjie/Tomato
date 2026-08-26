import {
  closeProviderRuntimeNativeExactObjectPublisherV1,
  openProviderRuntimeNativeExactObjectPublisherV1,
  revalidateProviderRuntimeNativeExactObjectPublisherV1,
  type ProviderRuntimeNativeExactObjectPublisherV1,
} from "@understand-code/native-kernel-bridge";

import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  type ContentDigestV1,
  type DurableObjectIdentityProviderIdV1,
  type InstallationIdentityGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcPrincipalAttestationV1,
  type ProviderRuntimeIpcStrongMutationRequestV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";

export const PROVIDER_STRONG_MUTATION_LINUX_EXT4_FENCE_PROFILE_INTERNAL_V1 =
  "linux_ext4_exact_object_dedicated_os_principal_v1" as const;
export const PROVIDER_STRONG_MUTATION_NATIVE_EXACT_OBJECT_BLOCKER_INTERNAL_V1 =
  "linux_ext4_exact_object_native_authority_unavailable" as const;

declare const providerStrongMutationExecutionFenceCapabilityBrandInternalV1:
  unique symbol;
declare const providerStrongMutationLinuxExt4ExactObjectAuthorityCapabilityBrandInternalV1:
  unique symbol;
declare const providerStrongMutationExecutionLeaseCapabilityBrandInternalV1:
  unique symbol;

/** Opaque process-local authority; JSON or a structurally equal object cannot mint it. */
export interface ProviderStrongMutationExecutionFenceCapabilityInternalV1 {
  readonly [providerStrongMutationExecutionFenceCapabilityBrandInternalV1]: true;
}

/**
 * Reserved for the future native Linux/ext4 exact-object provider.  No
 * production constructor exists until that provider can return kernel-backed
 * object and principal evidence; a structural cast cannot cross this boundary.
 */
export interface ProviderStrongMutationLinuxExt4ExactObjectAuthorityCapabilityInternalV1 {
  readonly [providerStrongMutationLinuxExt4ExactObjectAuthorityCapabilityBrandInternalV1]:
    true;
}

export interface ProviderStrongMutationExecutionLeaseCapabilityInternalV1 {
  readonly [providerStrongMutationExecutionLeaseCapabilityBrandInternalV1]: true;
}

export interface OpenProviderStrongMutationLinuxExt4ExactObjectAuthorityInputInternalV1
  extends Omit<
    RegisterProviderStrongMutationLinuxExt4ExecutionFenceInputInternalV1,
    "revalidateExactObjectAuthority"
  > {
  /** Opened once, then never used again for authority after construction. */
  readonly targetDirectoryPath: string;
  readonly providerDirectoryPath: string;
}

export interface ProviderStrongMutationExecutionFenceRevalidationInputInternalV1 {
  readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
  readonly principalAttestation: ProviderRuntimeIpcPrincipalAttestationV1;
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
}

export interface RegisterProviderStrongMutationLinuxExt4ExecutionFenceInputInternalV1 {
  readonly profile:
    typeof PROVIDER_STRONG_MUTATION_LINUX_EXT4_FENCE_PROFILE_INTERNAL_V1;
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly targetProfileId: string;
  readonly targetFingerprintDigest: ContentDigestV1;
  readonly capabilityDigest: ContentDigestV1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly principal: Readonly<{
    readonly uid: number;
    readonly gid: number;
    readonly handoffPayloadDigest: ContentDigestV1;
  }>;
  /**
   * Callback is supplied only by the native exact-object composition root. It
   * must revalidate the held Linux/ext4 target and provider authority for this
   * exact request immediately before broker admission.
   */
  readonly revalidateExactObjectAuthority: (
    input: ProviderStrongMutationExecutionFenceRevalidationInputInternalV1,
  ) => boolean | Promise<boolean>;
}

interface ProviderStrongMutationExecutionFenceStateInternalV1
  extends RegisterProviderStrongMutationLinuxExt4ExecutionFenceInputInternalV1 {}

const fenceStatesV1 = new WeakMap<
  object,
  ProviderStrongMutationExecutionFenceStateInternalV1
>();
interface ExactObjectAuthorityStateInternalV1 {
  readonly registration:
    OpenProviderStrongMutationLinuxExt4ExactObjectAuthorityInputInternalV1;
  readonly target: ProviderRuntimeNativeExactObjectPublisherV1;
  readonly provider: ProviderRuntimeNativeExactObjectPublisherV1;
}
const exactObjectAuthorityStatesV1 = new WeakMap<
  object,
  ExactObjectAuthorityStateInternalV1
>();
const executionLeaseStatesV1 = new WeakMap<object, Readonly<{
  readonly bindingDigest: ContentDigestV1;
  readonly requestDigest: ContentDigestV1;
  readonly activate: () => Promise<boolean>;
}>>();

function kernelIdV1(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 0xffff_ffff) {
    throw new TypeError("provider execution-fence principal is invalid");
  }
  return value;
}

function targetProfileIdV1(value: string): string {
  if (!/^provider-target-profile:[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError("provider execution-fence target profile is invalid");
  }
  return value;
}

function registerFenceV1(
  input: RegisterProviderStrongMutationLinuxExt4ExecutionFenceInputInternalV1,
  observedPlatform: NodeJS.Platform,
  observedUid: number | undefined,
  observedGid: number | undefined,
): ProviderStrongMutationExecutionFenceCapabilityInternalV1 {
  const principal = Object.freeze({
    uid: kernelIdV1(input.principal.uid),
    gid: kernelIdV1(input.principal.gid),
    handoffPayloadDigest: ContentDigestV1Schema.parse(
      input.principal.handoffPayloadDigest,
    ),
  });
  if (
    input.profile !==
      PROVIDER_STRONG_MUTATION_LINUX_EXT4_FENCE_PROFILE_INTERNAL_V1 ||
    observedPlatform !== "linux" ||
    (observedUid === 0
      ? observedGid !== 0
      : observedUid !== principal.uid || observedGid !== principal.gid) ||
    typeof input.revalidateExactObjectAuthority !== "function"
  ) {
    throw new TypeError("provider execution fence is unavailable");
  }
  const capability = Object.freeze(Object.create(null)) as
    ProviderStrongMutationExecutionFenceCapabilityInternalV1;
  fenceStatesV1.set(capability, Object.freeze({
    profile: PROVIDER_STRONG_MUTATION_LINUX_EXT4_FENCE_PROFILE_INTERNAL_V1,
    providerId: DurableObjectIdentityProviderIdV1Schema.parse(input.providerId),
    targetProfileId: targetProfileIdV1(input.targetProfileId),
    targetFingerprintDigest: ContentDigestV1Schema.parse(
      input.targetFingerprintDigest,
    ),
    capabilityDigest: ContentDigestV1Schema.parse(input.capabilityDigest),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema.parse(
        input.installationIdentityGenerationId,
      ),
    principal,
    revalidateExactObjectAuthority: input.revalidateExactObjectAuthority,
  }));
  return capability;
}

/** Open and retain the two exact Linux/ext4 directories used by publication. */
export async function openProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1(
  input: OpenProviderStrongMutationLinuxExt4ExactObjectAuthorityInputInternalV1,
): Promise<ProviderStrongMutationLinuxExt4ExactObjectAuthorityCapabilityInternalV1> {
  if (process.platform !== "linux") {
    throw new TypeError(PROVIDER_STRONG_MUTATION_NATIVE_EXACT_OBJECT_BLOCKER_INTERNAL_V1);
  }
  const uid = typeof process.geteuid === "function"
    ? process.geteuid()
    : process.getuid?.();
  const gid = typeof process.getegid === "function"
    ? process.getegid()
    : process.getgid?.();
  if (
    uid !== 0 &&
    (uid !== input.principal.uid || gid !== input.principal.gid)
  ) {
    throw new TypeError(PROVIDER_STRONG_MUTATION_NATIVE_EXACT_OBJECT_BLOCKER_INTERNAL_V1);
  }
  const opened: ProviderRuntimeNativeExactObjectPublisherV1[] = [];
  try {
    const retain = (path: string): ProviderRuntimeNativeExactObjectPublisherV1 => {
      const publisher = openProviderRuntimeNativeExactObjectPublisherV1(path, {
        expectedOwnerUid: input.principal.uid,
        expectedOwnerGid: input.principal.gid,
      });
      opened.push(publisher);
      revalidateProviderRuntimeNativeExactObjectPublisherV1(publisher);
      return publisher;
    };
    const target = retain(input.targetDirectoryPath);
    const provider = retain(input.providerDirectoryPath);
    const capability = Object.freeze(Object.create(null)) as
      ProviderStrongMutationLinuxExt4ExactObjectAuthorityCapabilityInternalV1;
    exactObjectAuthorityStatesV1.set(capability, Object.freeze({
      registration: Object.freeze({ ...input }),
      target,
      provider,
    }));
    opened.length = 0;
    return capability;
  } finally {
    for (const publisher of opened) {
      try {
        closeProviderRuntimeNativeExactObjectPublisherV1(publisher);
      } catch {
        // Preserve the original native admission failure.
      }
    }
  }
}

/** Production registration accepts only the retained native-backed authority. */
export function registerProviderStrongMutationLinuxExt4ExecutionFenceInternalV1(
  exactObjectAuthority:
    ProviderStrongMutationLinuxExt4ExactObjectAuthorityCapabilityInternalV1,
): ProviderStrongMutationExecutionFenceCapabilityInternalV1 {
  const exact = exactObjectAuthorityStatesV1.get(exactObjectAuthority as object);
  if (exact === undefined) {
    throw new TypeError(PROVIDER_STRONG_MUTATION_NATIVE_EXACT_OBJECT_BLOCKER_INTERNAL_V1);
  }
  const revalidate = (): boolean => {
    try {
      revalidateProviderRuntimeNativeExactObjectPublisherV1(exact.target);
      revalidateProviderRuntimeNativeExactObjectPublisherV1(exact.provider);
      return true;
    } catch {
      return false;
    }
  };
  return registerFenceV1(
    {
      ...exact.registration,
      revalidateExactObjectAuthority: revalidate,
    },
    process.platform,
    typeof process.geteuid === "function" ? process.geteuid() : process.getuid?.(),
    typeof process.getegid === "function" ? process.getegid() : process.getgid?.(),
  );
}

export async function closeProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1(
  capability: ProviderStrongMutationLinuxExt4ExactObjectAuthorityCapabilityInternalV1,
): Promise<void> {
  const state = exactObjectAuthorityStatesV1.get(capability as object);
  exactObjectAuthorityStatesV1.delete(capability as object);
  if (state === undefined) return;
  for (const publisher of [state.target, state.provider]) {
    try {
      closeProviderRuntimeNativeExactObjectPublisherV1(publisher);
    } catch {
      // Both retained authorities are always attempted.
    }
  }
}

/** Source-internal test bridge; the public package never exports this symbol. */
export function registerProviderStrongMutationLinuxExt4ExecutionFenceForTestInternalV1(
  input: RegisterProviderStrongMutationLinuxExt4ExecutionFenceInputInternalV1,
): ProviderStrongMutationExecutionFenceCapabilityInternalV1 {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    throw new TypeError("provider execution-fence test bridge is unavailable");
  }
  return registerFenceV1(
    input,
    "linux",
    input.principal.uid,
    input.principal.gid,
  );
}

export function assertProviderStrongMutationExecutionFenceCapabilityInternalV1(
  capability: ProviderStrongMutationExecutionFenceCapabilityInternalV1,
): void {
  if (!fenceStatesV1.has(capability as object)) {
    throw new TypeError("provider execution-fence capability is invalid");
  }
}

function exactAcceptanceIdentityV1(
  left: ProviderRuntimeIpcAcceptanceIdentityProofV1,
  right: ProviderRuntimeIpcAcceptanceIdentityProofV1,
): boolean {
  return left.generationId === right.generationId &&
    left.contentDigest === right.contentDigest &&
    left.acceptanceOrdinal === right.acceptanceOrdinal &&
    left.installationIdentityGenerationId ===
      right.installationIdentityGenerationId;
}

/** Revalidate every durable/replayed intent against the exact registered fence. */
export async function revalidateProviderStrongMutationExecutionFenceInternalV1(
  capability: ProviderStrongMutationExecutionFenceCapabilityInternalV1,
  input: ProviderStrongMutationExecutionFenceRevalidationInputInternalV1,
): Promise<ProviderStrongMutationExecutionLeaseCapabilityInternalV1 | undefined> {
  const state = fenceStatesV1.get(capability as object);
  if (state === undefined) return undefined;
  try {
    const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
      input.request,
    );
    const attestation = ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(
      input.principalAttestation,
    );
    const acceptanceIdentity =
      ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse(
        input.acceptanceIdentity,
      );
    const grant = request.authorityGrant.payload;
    if (
      grant.providerId !== state.providerId ||
      grant.targetProfileId !== state.targetProfileId ||
      grant.targetFingerprintDigest !== state.targetFingerprintDigest ||
      grant.capabilityDigest !== state.capabilityDigest ||
      grant.acceptanceIdentity.installationIdentityGenerationId !==
        state.installationIdentityGenerationId ||
      !exactAcceptanceIdentityV1(grant.acceptanceIdentity, acceptanceIdentity) ||
      attestation.providerId !== state.providerId ||
      attestation.capabilityDigest !== state.capabilityDigest ||
      attestation.handoffPayloadDigest !==
        state.principal.handoffPayloadDigest ||
      attestation.revision !== grant.journalHead.revision ||
      attestation.phase !== grant.journalHead.phase ||
      attestation.mutationDigest !== grant.journalHead.mutationDigest ||
      attestation.acceptanceIdentity === undefined ||
      !exactAcceptanceIdentityV1(
        attestation.acceptanceIdentity,
        acceptanceIdentity,
      )
    ) {
      return undefined;
    }
    const held = await state.revalidateExactObjectAuthority(Object.freeze({
      request,
      principalAttestation: attestation,
      acceptanceIdentity,
    })) === true;
    if (!held) return undefined;
    const lease = Object.freeze(Object.create(null)) as
      ProviderStrongMutationExecutionLeaseCapabilityInternalV1;
    executionLeaseStatesV1.set(lease, Object.freeze({
      bindingDigest: request.bindingDigest,
      requestDigest: request.requestDigest,
      activate: async () =>
        await state.revalidateExactObjectAuthority(Object.freeze({
          request,
          principalAttestation: attestation,
          acceptanceIdentity,
        })) === true,
    }));
    return lease;
  } catch {
    return undefined;
  }
}

/** Delete-before-return; serialized or replayed lease lookalikes always fail. */
export async function consumeProviderStrongMutationExecutionLeaseInternalV1(
  lease: ProviderStrongMutationExecutionLeaseCapabilityInternalV1,
  expected: Readonly<{
    readonly bindingDigest: ContentDigestV1;
    readonly requestDigest: ContentDigestV1;
  }>,
): Promise<boolean> {
  const state = executionLeaseStatesV1.get(lease as object);
  executionLeaseStatesV1.delete(lease as object);
  return state !== undefined &&
    state.bindingDigest === expected.bindingDigest &&
    state.requestDigest === expected.requestDigest &&
    await state.activate();
}
