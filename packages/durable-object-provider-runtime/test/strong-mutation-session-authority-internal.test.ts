import { describe, expect, it } from "vitest";

import {
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
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
  const providerId = DurableObjectIdentityProviderIdV1Schema.parse(
    "durable-object-provider:strong-authority-test",
  );
  const capabilityDigest = ContentDigestV1Schema.parse(
    `sha256:${"1".repeat(64)}`,
  );
  const principalAttestationDigest = ContentDigestV1Schema.parse(
    `sha256:${"2".repeat(64)}`,
  );
  const requestDigest = ContentDigestV1Schema.parse(
    `sha256:${"4".repeat(64)}`,
  );
  const journalHead = {
    revision: 7,
    phase: "final_strong_ready",
    mutationDigest: ContentDigestV1Schema.parse(
      `sha256:${"5".repeat(64)}`,
    ),
  };
  const acceptanceIdentity =
    ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse({
      generationId: `provider-acceptance-state:${"6".repeat(22)}`,
      contentDigest: `sha256:${"7".repeat(64)}`,
      acceptanceOrdinal: 1,
      installationIdentityGenerationId:
        `installation-identity-generation:${"8".repeat(22)}`,
    });
  const grantFields = {
    signerKeyId: "9".repeat(22),
    providerId,
    targetProfileId: `provider-target-profile:${"a".repeat(64)}`,
    targetFingerprintDigest: `sha256:${"b".repeat(64)}`,
    registryManifest: {
      locatorProfile: "installation_provider_registry_manifest_v1" as const,
      manifestGeneration: 1,
      generationId: `provider-registry-manifest:${"c".repeat(22)}`,
      contentDigest: `sha256:${"d".repeat(64)}`,
    },
    acceptanceIdentity,
    capabilityDigest,
    principalAttestationDigest,
    journalHead,
    operation: "write_object" as const,
    operationNonce: "3".repeat(32),
    requestDigest,
  };
  const grantId =
    deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(grantFields);
  const payload = {
    profile:
      "provider_runtime_ipc_strong_mutation_authority_grant_v1" as const,
    grantId,
    ...grantFields,
    signature: `base64url:${Buffer.alloc(64).toString("base64url")}`,
  };
  const authorityGrant =
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType:
        "provider_runtime_ipc_strong_mutation_authority_grant",
      grantId,
      contentDigest:
        deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
          payload,
        ),
      payload,
    });
  return {
    providerId,
    capabilityDigest,
    principalAttestationDigest,
    bindingDigest: ContentDigestV1Schema.parse(
      `sha256:${bindingDigit.repeat(64)}`,
    ),
    operation: "write_object",
    operationNonce: "3".repeat(32),
    requestDigest,
    authorityGrant,
    journalHead,
    acceptanceIdentity,
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
          if (authoritativeConsumedGrants.has(context.authorityGrant.grantId)) {
            return false;
          }
          authoritativeConsumedGrants.add(context.authorityGrant.grantId);
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
      new Set([context.authorityGrant.grantId]),
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
