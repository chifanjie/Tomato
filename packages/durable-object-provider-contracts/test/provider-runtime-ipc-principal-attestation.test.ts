import { describe, expect, it } from "vitest";

import {
  ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema,
  canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1,
} from "../src/provider-runtime-ipc-v1.js";

const BASE_CLAIMS_V1 = Object.freeze({
  providerId: "durable-object-provider:principal-proof-test",
  capabilityDigest: `sha256:${"1".repeat(64)}`,
  challenge: "2".repeat(64),
  processId: 42,
  revision: 7,
  phase: "final_strong_ready",
  mutationDigest: `sha256:${"3".repeat(64)}`,
  handoffPayloadDigest: `sha256:${"4".repeat(64)}`,
  publicKey: "base64url:AQ",
});

const ACCEPTANCE_IDENTITY_V1 = Object.freeze({
  generationId: `provider-acceptance-state:${"5".repeat(22)}`,
  contentDigest: `sha256:${"6".repeat(64)}`,
  acceptanceOrdinal: 1,
  installationIdentityGenerationId:
    `installation-identity-generation:${"7".repeat(22)}`,
});

describe("provider runtime principal Acceptance identity claims", () => {
  it("strictly includes the exact Acceptance identity proof in canonical signed claims", () => {
    const claims = ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema.parse({
      ...BASE_CLAIMS_V1,
      acceptanceIdentity: ACCEPTANCE_IDENTITY_V1,
    });
    const canonical = new TextDecoder().decode(
      canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1(claims),
    );

    expect(claims.acceptanceIdentity).toEqual(ACCEPTANCE_IDENTITY_V1);
    expect(canonical).toContain('"acceptanceIdentity"');
    expect(canonical).toContain(ACCEPTANCE_IDENTITY_V1.generationId);
    expect(canonical).toContain(
      ACCEPTANCE_IDENTITY_V1.installationIdentityGenerationId,
    );
  });

  it("keeps missing-proof compatibility and rejects a foreign proof shape", () => {
    expect(
      ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema.parse(
        BASE_CLAIMS_V1,
      ).acceptanceIdentity,
    ).toBeUndefined();

    expect(() =>
      ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema.parse({
        ...BASE_CLAIMS_V1,
        acceptanceIdentity: {
          ...ACCEPTANCE_IDENTITY_V1,
          foreignGenerationId:
            `provider-acceptance-state:${"8".repeat(22)}`,
        },
      }),
    ).toThrow();
  });
});
