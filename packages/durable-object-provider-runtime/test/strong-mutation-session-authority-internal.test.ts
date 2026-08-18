import { describe, expect, it } from "vitest";

import {
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";

import {
  consumeProviderRuntimeStrongMutationAuthorityGrantInternalV1,
  consumeProviderRuntimeStrongMutationSessionCapabilityInternalV1,
  mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1,
  type ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1,
} from "../src/strong-mutation-session-authority-internal.js";

function contextV1(
  bindingDigit: string,
): ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1 {
  return {
    providerId: DurableObjectIdentityProviderIdV1Schema.parse(
      "durable-object-provider:strong-authority-test",
    ),
    capabilityDigest: ContentDigestV1Schema.parse(
      `sha256:${"1".repeat(64)}`,
    ),
    principalAttestationDigest: ContentDigestV1Schema.parse(
      `sha256:${"2".repeat(64)}`,
    ),
    bindingDigest: ContentDigestV1Schema.parse(
      `sha256:${bindingDigit.repeat(64)}`,
    ),
    operation: "write_object",
    operationNonce: "3".repeat(32),
    requestDigest: ContentDigestV1Schema.parse(
      `sha256:${"4".repeat(64)}`,
    ),
    authorityGrant: "base64url:AQ",
    journalHead: {
      revision: 7,
      phase: "final_strong_ready",
      mutationDigest: ContentDigestV1Schema.parse(
        `sha256:${"5".repeat(64)}`,
      ),
    },
    acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse({
      generationId: `provider-acceptance-state:${"6".repeat(22)}`,
      contentDigest: `sha256:${"7".repeat(64)}`,
      acceptanceOrdinal: 1,
      installationIdentityGenerationId:
        `installation-identity-generation:${"8".repeat(22)}`,
    }),
  };
}

describe("runtime-private strong mutation authority", () => {
  it("atomically consumes a durable grant across different session bindings", async () => {
    let consumeCalls = 0;
    const authoritativeConsumedGrants = new Set<string>();
    const verifier =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant(context) {
          consumeCalls += 1;
          if (authoritativeConsumedGrants.has(context.authorityGrant)) {
            return false;
          }
          authoritativeConsumedGrants.add(context.authorityGrant);
          return true;
        },
      });
    const context = contextV1("a");
    const reboundContext = contextV1("b");
    const session =
      await consumeProviderRuntimeStrongMutationAuthorityGrantInternalV1(
        verifier,
        context,
      );
    expect(session).toBeDefined();
    await expect(
      consumeProviderRuntimeStrongMutationAuthorityGrantInternalV1(
        verifier,
        reboundContext,
      ),
    ).resolves.toBeUndefined();
    expect(consumeCalls).toBe(2);
    expect(authoritativeConsumedGrants).toEqual(
      new Set([context.authorityGrant]),
    );
    expect(
      consumeProviderRuntimeStrongMutationSessionCapabilityInternalV1(
        session!,
        context.bindingDigest,
      ),
    ).toBe(true);
    expect(
      consumeProviderRuntimeStrongMutationSessionCapabilityInternalV1(
        session!,
        context.bindingDigest,
      ),
    ).toBe(false);
  });

  it("does not burn a binding when the external atomic consume rejects it", async () => {
    let consumeCalls = 0;
    const verifier =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant() {
          consumeCalls += 1;
          return consumeCalls === 2;
        },
      });
    const context = contextV1("b");
    await expect(
      consumeProviderRuntimeStrongMutationAuthorityGrantInternalV1(
        verifier,
        context,
      ),
    ).resolves.toBeUndefined();
    await expect(
      consumeProviderRuntimeStrongMutationAuthorityGrantInternalV1(
        verifier,
        context,
      ),
    ).resolves.toBeDefined();
    expect(consumeCalls).toBe(2);
  });
});
