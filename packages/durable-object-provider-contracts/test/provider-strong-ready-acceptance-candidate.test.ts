import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ProviderCryptoHostV1 } from "../src/domain-crypto.js";
import type {
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "../src/provider-distribution-history-current-candidate-point.js";
import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-real-filesystem-source-fixtures.js";
import {
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_PATH_V1,
  materializeProviderDistributionHistoryCurrentCandidatePointPositiveVectorRequestV1,
  verifyProviderDistributionHistoryCurrentCandidatePointGoldenResourceV1,
  type ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1,
} from "../src/provider-distribution-history-current-candidate-point-fixtures.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-registry-manifest-fixtures.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-registry-root-history-fixtures.js";
import {
  PROVIDER_STRONG_READY_ACCEPTANCE_CANDIDATE_AUTHORITY_V1,
  ProviderStrongReadyAcceptanceCandidateValidationError,
  createProviderStrongReadyAcceptanceCandidateV1,
  diagnoseCreateProviderStrongReadyAcceptanceCandidateV1,
  deriveProviderActiveWriterSelectorContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  diagnoseProviderStrongReadyAcceptanceCandidateV1,
  validateProviderStrongReadyAcceptanceCandidateV1,
  type ProviderStrongReadyAcceptanceCandidateValidationV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "../src/provider-strong-ready-acceptance-candidate.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
} from "../src/provider-registry-trust.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";
import {
  buildProviderStrongReadyAcceptanceSingleTargetRawRequestFixture,
  type ProviderStrongReadyAcceptanceSingleTargetRawRequestFixtureV1,
} from "../scripts/lib/provider-strong-ready-acceptance-candidate-fixture.mjs";

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

function cloneJsonV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectRecursivelyFrozenV1(
  value: unknown,
  seen = new Set<object>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectRecursivelyFrozenV1(descriptor.value, seen);
    }
  }
}

const cryptoHost: ProviderCryptoHostV1 = Object.freeze({
  sha256(message: Uint8Array) {
    return new Uint8Array(createHash("sha256").update(message).digest());
  },
  hmacSha256(key: Uint8Array, message: Uint8Array) {
    return new Uint8Array(createHmac("sha256", key).update(message).digest());
  },
});
const installationIdentityKey = new Uint8Array(
  Array.from({ length: 32 }, (_, index) => index),
);
const acceptedAt = ProviderRegistryIsoTimestampV1Schema.parse(
  "2026-08-12T13:31:00Z",
);

let capability: ProviderStrictEd25519OpaqueCapabilityV1;
let golden:
  ProviderDistributionHistoryCurrentCandidatePointGoldenManifestV1;
let singleTargetDistributionRawRequest:
  ProviderStrongReadyAcceptanceSingleTargetRawRequestFixtureV1;

beforeAll(async () => {
  golden =
    verifyProviderDistributionHistoryCurrentCandidatePointGoldenResourceV1(
      resourceBytes(
        PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_PATH_V1,
      ),
    );
  const strictManifestBytes = resourceBytes(
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  );
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint,
      verifyRawEd25519,
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        expect(path).toBe(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
        expect(maxBytes).toBe(PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1);
        return strictManifestBytes.slice();
      },
    }),
  });
  singleTargetDistributionRawRequest =
    buildProviderStrongReadyAcceptanceSingleTargetRawRequestFixture({
      rootGolden: JSON.parse(
        new TextDecoder().decode(
          resourceBytes(
            PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
          ),
        ),
      ),
      registryGolden: JSON.parse(
        new TextDecoder().decode(
          resourceBytes(
            PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
          ),
        ),
      ),
      sourceGolden: JSON.parse(
        new TextDecoder().decode(
          resourceBytes(
            PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
          ),
        ),
      ),
    });
});

function distributionInputV1():
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input {
  return {
    ...cloneJsonV1(singleTargetDistributionRawRequest),
    strictCryptoCapability: capability,
  };
}

function multiTargetDistributionInputV1() {
  return materializeProviderDistributionHistoryCurrentCandidatePointPositiveVectorRequestV1(
    golden,
    "genesis",
    capability,
  );
}

function createInputV1(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    distributionHistoryCandidate: distributionInputV1(),
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" as const },
    acceptedAt,
    installationIdentityKey: installationIdentityKey.slice(),
    cryptoHost,
    ...overrides,
  };
}

function validateInputV1(
  candidate: ProviderStrongReadyAcceptanceCandidateValidationV1,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    distributionHistoryCandidate: distributionInputV1(),
    acceptanceStateEnvelope: candidate.acceptanceStateEnvelope,
    installationIdentityKey: installationIdentityKey.slice(),
    cryptoHost,
    ...overrides,
  };
}

async function candidateV1() {
  return createProviderStrongReadyAcceptanceCandidateV1(createInputV1());
}

describe("Provider strong-ready Acceptance candidate", () => {
  it("derives the unique Registry-exact single-target selector and signed genesis candidate without current or I/O authority", async () => {
    const createDiagnostic =
      await diagnoseCreateProviderStrongReadyAcceptanceCandidateV1(
        createInputV1(),
      );
    expect(createDiagnostic).toMatchObject({ ok: true });
    const candidate = await candidateV1();

    expect(candidate.authority).toBe(
      PROVIDER_STRONG_READY_ACCEPTANCE_CANDIDATE_AUTHORITY_V1,
    );
    expect(Object.keys(candidate).sort()).toEqual([
      "acceptanceGenerationPin",
      "acceptanceStateEnvelope",
      "activeWriterSelector",
      "activeWriterSelectorContentDigest",
      "authority",
    ]);
    expect(candidate.activeWriterSelector.profile).toBe(
      "provider_active_writer_selector_v1",
    );
    expect(candidate.activeWriterSelector.selections).toHaveLength(1);
    expect(
      candidate.activeWriterSelector.selections.map((selection) =>
        selection.targetProfileId
      ),
    ).toEqual(
      [...candidate.activeWriterSelector.selections]
        .map((selection) => selection.targetProfileId)
        .sort(),
    );
    for (const selection of candidate.activeWriterSelector.selections) {
      expect(selection).toMatchObject({
        providerId: "durable-object-provider:native-b",
        bindingDerivationKeyGeneration: 1,
      });
      expect(selection.registryEntryContentDigest).toMatch(
        /^sha256:[0-9a-f]{64}$/u,
      );
      expect(selection.semanticProviderPolicyDigest).toMatch(
        /^sha256:[0-9a-f]{64}$/u,
      );
      expect(selection.runtimeAttestationContentDigest).toMatch(
        /^sha256:[0-9a-f]{64}$/u,
      );
    }
    expect(candidate.acceptanceStateEnvelope).toMatchObject({
      schemaVersion: 1,
      recordType: "provider_acceptance_state",
      acceptedAt,
      payload: {
        profile: "provider_acceptance_state_v1",
        acceptanceOrdinal: 1,
        predecessor: { state: "genesis" },
        acceptedAt,
        configuration: {
          state: "strong_ready",
          activation: { origin: "bootstrap_or_steady_successor" },
        },
      },
    });
    expect(candidate.acceptanceStateEnvelope.payload.acceptanceToken).toMatch(
      /^hmac-sha256:[0-9a-f]{64}$/u,
    );
    expect(candidate.acceptanceGenerationPin).toMatchObject({
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: 1,
      generationId: candidate.acceptanceStateEnvelope.generationId,
      contentDigest: candidate.acceptanceStateEnvelope.contentDigest,
    });
    expect(candidate.activeWriterSelectorContentDigest).toBe(
      deriveProviderActiveWriterSelectorContentDigestV1(
        candidate.activeWriterSelector,
      ),
    );
    expect(candidate.acceptanceStateEnvelope.generationId).toBe(
      deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
        installationIdentityGenerationId:
          candidate.acceptanceStateEnvelope.installationIdentityGenerationId,
        acceptanceOrdinal: 1,
        predecessor: { state: "genesis" },
        configuration: candidate.acceptanceStateEnvelope.payload.configuration,
      }),
    );
    expect(candidate.acceptanceStateEnvelope.contentDigest).toBe(
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(
        candidate.acceptanceStateEnvelope.payload,
      ),
    );
    expectRecursivelyFrozenV1(candidate);
  });

  it("rejects the signed two-target release Catalog when neither target is exact-bound to the steady Registry Entry", async () => {
    await expect(
      diagnoseCreateProviderStrongReadyAcceptanceCandidateV1(
        createInputV1({
          distributionHistoryCandidate: multiTargetDistributionInputV1(),
        }),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "active_writer_selector",
      reason: "selector_zero_match",
    });
  });

  it("revalidates the exact candidate and fails closed under the wrong owner key", async () => {
    const candidate = await candidateV1();
    await expect(
      validateProviderStrongReadyAcceptanceCandidateV1(
        validateInputV1(candidate),
      ),
    ).resolves.toEqual(candidate);

    const wrongKey = installationIdentityKey.slice();
    wrongKey[0] = wrongKey[0]! ^ 0xff;
    await expect(
      diagnoseProviderStrongReadyAcceptanceCandidateV1(
        validateInputV1(candidate, { installationIdentityKey: wrongKey }),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "acceptance_state",
      reason: "token_invalid",
    });
  });

  it.each([
    [
      "selector provider",
      (envelope: any) => {
        envelope.payload.configuration.core.activeWriterSelector.selections[0]
          .providerId = "durable-object-provider:forged";
      },
      "active_writer_selector",
      "selector_mismatch",
    ],
    [
      "generation ID",
      (envelope: any) => {
        const forged = `provider-acceptance-state:${"0".repeat(22)}`;
        envelope.generationId = forged;
        envelope.payload.generationId = forged;
      },
      "acceptance_state",
      "generation_mismatch",
    ],
    [
      "content digest",
      (envelope: any) => {
        envelope.contentDigest = `sha256:${"0".repeat(64)}`;
      },
      "acceptance_state",
      "digest_mismatch",
    ],
    [
      "Acceptance token",
      (envelope: any) => {
        envelope.payload.acceptanceToken =
          `hmac-sha256:${"0".repeat(64)}`;
      },
      "acceptance_state",
      "token_invalid",
    ],
    [
      "outer acceptedAt",
      (envelope: any) => {
        envelope.acceptedAt = "2026-08-12T13:31:01Z";
      },
      "acceptance_state",
      "envelope_mismatch",
    ],
  ] as const)(
    "rejects a forged %s with a bounded diagnostic and opaque public error",
    async (_label, mutate, stage, reason) => {
      const candidate = await candidateV1();
      const envelope = cloneJsonV1(candidate.acceptanceStateEnvelope);
      mutate(envelope);
      const input = validateInputV1(candidate, {
        acceptanceStateEnvelope: envelope,
      });

      await expect(
        diagnoseProviderStrongReadyAcceptanceCandidateV1(input),
      ).resolves.toEqual({ ok: false, stage, reason });
      await expect(
        validateProviderStrongReadyAcceptanceCandidateV1(input as never),
      ).rejects.toMatchObject({
        name: "ProviderStrongReadyAcceptanceCandidateValidationError",
        code: "provider_unavailable",
        reason: "attestation_invalid",
      });
      try {
        await validateProviderStrongReadyAcceptanceCandidateV1(input as never);
      } catch (error) {
        expect(error).toBeInstanceOf(
          ProviderStrongReadyAcceptanceCandidateValidationError,
        );
        expect(Object.isFrozen(error)).toBe(true);
      }
    },
  );

  it("rejects predecessor/ordinal disagreement and exact top-level extras before cryptography", async () => {
    const host = Object.freeze({
      sha256: vi.fn(cryptoHost.sha256),
      hmacSha256: vi.fn(cryptoHost.hmacSha256),
    });
    await expect(
      createProviderStrongReadyAcceptanceCandidateV1(
        createInputV1({
          acceptanceOrdinal: 2,
          predecessor: { state: "genesis" },
          cryptoHost: host,
        }) as never,
      ),
    ).rejects.toBeInstanceOf(
      ProviderStrongReadyAcceptanceCandidateValidationError,
    );
    await expect(
      createProviderStrongReadyAcceptanceCandidateV1({
        ...createInputV1({ cryptoHost: host }),
        current: true,
      } as never),
    ).rejects.toBeInstanceOf(
      ProviderStrongReadyAcceptanceCandidateValidationError,
    );
    expect(host.sha256).not.toHaveBeenCalled();
    expect(host.hmacSha256).not.toHaveBeenCalled();
  });

  it("rejects getters without invoking them", async () => {
    let invoked = false;
    const input = Object.defineProperty(
      { ...createInputV1() },
      "acceptedAt",
      {
        enumerable: true,
        get() {
          invoked = true;
          return acceptedAt;
        },
      },
    );
    await expect(
      createProviderStrongReadyAcceptanceCandidateV1(input as never),
    ).rejects.toBeInstanceOf(
      ProviderStrongReadyAcceptanceCandidateValidationError,
    );
    expect(invoked).toBe(false);
  });

  it("binds the owner key and acceptedAt into the stable token/digest while leaving the generation ID time-independent", async () => {
    const first = await candidateV1();
    const later = await createProviderStrongReadyAcceptanceCandidateV1(
      createInputV1({
        acceptedAt: ProviderRegistryIsoTimestampV1Schema.parse(
          "2026-08-12T13:31:01Z",
        ),
      }),
    );
    const alternateKey = installationIdentityKey.slice();
    alternateKey[31] = alternateKey[31]! ^ 0xff;
    const alternate = await createProviderStrongReadyAcceptanceCandidateV1(
      createInputV1({ installationIdentityKey: alternateKey }),
    );

    expect(later.acceptanceStateEnvelope.generationId).toBe(
      first.acceptanceStateEnvelope.generationId,
    );
    expect(later.acceptanceStateEnvelope.contentDigest).not.toBe(
      first.acceptanceStateEnvelope.contentDigest,
    );
    expect(later.acceptanceStateEnvelope.payload.acceptanceToken).not.toBe(
      first.acceptanceStateEnvelope.payload.acceptanceToken,
    );
    expect(alternate.acceptanceStateEnvelope.generationId).toBe(
      first.acceptanceStateEnvelope.generationId,
    );
    expect(alternate.acceptanceStateEnvelope.contentDigest).toBe(
      first.acceptanceStateEnvelope.contentDigest,
    );
    expect(alternate.acceptanceStateEnvelope.payload.acceptanceToken).not.toBe(
      first.acceptanceStateEnvelope.payload.acceptanceToken,
    );
  });

  it("does not late-bind mutable ordering or hex/string primordials after module initialization", async () => {
    const candidate = await candidateV1();
    const generationFields = {
      installationIdentityGenerationId:
        candidate.acceptanceStateEnvelope.installationIdentityGenerationId,
      acceptanceOrdinal: 1,
      predecessor: { state: "genesis" as const },
      configuration: candidate.acceptanceStateEnvelope.payload.configuration,
    };
    const expectedSelectorDigest =
      deriveProviderActiveWriterSelectorContentDigestV1(
        candidate.activeWriterSelector,
      );
    const expectedGenerationId =
      deriveProviderStrongReadyAcceptanceStateGenerationIdV1(
        generationFields,
      );
    const candidates = [
      { owner: Math, key: "min" },
      { owner: Number.prototype, key: "toString" },
      { owner: String.prototype, key: "padStart" },
      { owner: String.prototype, key: "slice" },
    ] as const;
    const originals = candidates.map((entry) => {
      const descriptor = Object.getOwnPropertyDescriptor(
        entry.owner,
        entry.key,
      );
      if (descriptor === undefined) {
        throw new TypeError(`${entry.key} descriptor unavailable`);
      }
      return { ...entry, descriptor };
    });
    let poisonCalls = 0;
    try {
      for (const entry of originals) {
        Object.defineProperty(entry.owner, entry.key, {
          ...entry.descriptor,
          value() {
            poisonCalls += 1;
            throw new TypeError(`late-bound ${entry.key}`);
          },
        });
      }
      expect(
        deriveProviderActiveWriterSelectorContentDigestV1(
          candidate.activeWriterSelector,
        ),
      ).toBe(expectedSelectorDigest);
      expect(
        deriveProviderStrongReadyAcceptanceStateGenerationIdV1(
          generationFields,
        ),
      ).toBe(expectedGenerationId);
    } finally {
      for (const entry of originals) {
        Object.defineProperty(entry.owner, entry.key, entry.descriptor);
      }
    }
    expect(poisonCalls).toBe(0);
  });

  it("rejects malformed candidate Envelopes at the input stage", async () => {
    const candidate = await candidateV1();
    const envelope = cloneJsonV1(
      candidate.acceptanceStateEnvelope,
    ) as ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1 & {
      extra?: boolean;
    };
    envelope.extra = true;
    await expect(
      diagnoseProviderStrongReadyAcceptanceCandidateV1(
        validateInputV1(candidate, { acceptanceStateEnvelope: envelope }),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
  });
});
