import { createHash, createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { ProviderCryptoHostV1 } from "../src/domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "../src/jcs.js";
import {
  PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_CURRENT_VERSION_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1,
  projectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1,
  projectProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import {
  verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-reference-candidate.js";
import {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1,
  assertProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1,
  deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1,
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
  verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1,
  verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1,
  verifyProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import {
  INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
  INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1,
} from "../src/provider-foundation.js";
import {
  KeyedStateTokenV1Schema,
  type KeyedStateTokenV1,
} from "../src/primitives.js";
import {
  PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
  ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderStrongReadyAcceptanceStateUnsignedCandidateV1,
} from "../src/provider-strong-ready-acceptance-candidate.js";

const CapturedUint8ArrayV1 = Uint8Array;
const INITIALIZATION_NONCE_V1 = "000102030405060708090a0b0c0d0e0f";
const INSTALLATION_IDENTITY_GENERATION_ID_V1 =
  "installation-identity-generation:4fe634940e20afac35e02d";
const INSTALLATION_IDENTITY_KEY_CHECK_TOKEN_V1 =
  "hmac-sha256:9b585cbb13d23ae739df3988278dfdc09ed612ccd8af853ac26f570bc8ce2eef";
const INSTALLATION_IDENTITY_KEY_V1 = new CapturedUint8ArrayV1(
  Array.from({ length: 32 }, (_value, index) => index),
);

function digestV1(nibble: string): `sha256:${string}` {
  return `sha256:${nibble.repeat(64)}`;
}

function tokenV1(nibble: string): KeyedStateTokenV1 {
  return KeyedStateTokenV1Schema.parse(`hmac-sha256:${nibble.repeat(64)}`);
}

function cryptoHostV1(): ProviderCryptoHostV1 {
  return {
    sha256(message: Uint8Array) {
      return new CapturedUint8ArrayV1(
        createHash("sha256").update(message).digest(),
      );
    },
    hmacSha256(key: Uint8Array, message: Uint8Array) {
      return new CapturedUint8ArrayV1(
        createHmac("sha256", key).update(message).digest(),
      );
    },
  };
}

function expectedTokenV1(
  domain: string,
  fields: object,
  key = INSTALLATION_IDENTITY_KEY_V1,
): `hmac-sha256:${string}` {
  const message = new TextEncoder().encode(
    canonicalizeJcsSafeIntegerV1([domain, fields]),
  );
  return `hmac-sha256:${createHmac("sha256", key).update(message).digest("hex")}`;
}

async function mintV1(
  overrides: Readonly<Record<string, unknown>> = {},
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1> {
  return mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1({
    initializationNonce: INITIALIZATION_NONCE_V1,
    installationIdentityGenerationId:
      INSTALLATION_IDENTITY_GENERATION_ID_V1,
    keyCheckToken: INSTALLATION_IDENTITY_KEY_CHECK_TOKEN_V1,
    installationIdentityKey: INSTALLATION_IDENTITY_KEY_V1.slice(),
    cryptoHost: cryptoHostV1(),
    ...overrides,
  } as never);
}

function acceptanceStateV1(): ProviderStrongReadyAcceptanceStateUnsignedCandidateV1 {
  const configuration = {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: {
        locatorProfile:
          "installation_provider_registry_root_metadata_v1" as const,
        rootGeneration: 1,
        rootKeyId: "1".repeat(22),
        contentDigest: digestV1("1"),
      },
      providerRegistryManifest: {
        locatorProfile:
          "installation_provider_registry_manifest_v1" as const,
        manifestGeneration: 1,
        generationId: `provider-registry-manifest:${"2".repeat(22)}`,
        contentDigest: digestV1("2"),
      },
      providerSupportCatalog: {
        locatorProfile:
          "distribution_provider_feasibility_support_catalog_v1" as const,
        catalogGeneration: 1,
        contentDigest: digestV1("3"),
      },
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1" as const,
        selections: [{
          targetProfileId: `provider-target-profile:${"4".repeat(64)}`,
          providerId: "durable-object-provider:identity-cap-test",
          registryEntryContentDigest: digestV1("5"),
          semanticProviderPolicyDigest: digestV1("6"),
          providerFeasibilityEvidence: {
            locatorProfile:
              "installation_provider_feasibility_evidence_v1" as const,
            evidenceId: `provider-feasibility-evidence:${"7".repeat(22)}`,
            contentDigest: digestV1("7"),
          },
          runtimeAttestationContentDigest: digestV1("8"),
          bindingDerivationKeyGeneration: 1,
        }],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
  const predecessor = { state: "genesis" as const };
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1(
    {
      installationIdentityGenerationId:
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
      acceptanceOrdinal: 1,
      predecessor,
      configuration,
    },
  );
  return ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema.parse({
    profile: "provider_acceptance_state_v1",
    generationId,
    installationIdentityGenerationId:
      INSTALLATION_IDENTITY_GENERATION_ID_V1,
    acceptanceOrdinal: 1,
    predecessor,
    configuration,
    acceptedAt: "2026-08-13T03:00:00Z",
  });
}

function acceptanceEnvelopeV1(
  state: ProviderStrongReadyAcceptanceStateUnsignedCandidateV1,
  acceptanceToken: KeyedStateTokenV1 = tokenV1("a"),
) {
  return {
    schemaVersion: 1 as const,
    recordType: "provider_acceptance_state" as const,
    generationId: state.generationId,
    installationIdentityGenerationId:
      state.installationIdentityGenerationId,
    acceptedAt: state.acceptedAt,
    contentDigest: deriveProviderStrongReadyAcceptanceStateContentDigestV1(
      state,
    ),
    payload: { ...state, acceptanceToken },
  };
}

function highWaterEnvelopeV1(
  state: ProviderStrongReadyAcceptanceStateUnsignedCandidateV1,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1 {
  const payload = ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema.parse({
    profile: "provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
    installationIdentityGenerationId:
      state.installationIdentityGenerationId,
    highWaterRevision: 1,
    operationNonce: "b".repeat(32),
    predecessor: { state: "genesis", expectedNamespaceState: "absent" },
    currentAcceptance: {
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: 1,
      generationId: state.generationId,
      contentDigest: deriveProviderStrongReadyAcceptanceStateContentDigestV1(
        state,
      ),
    },
    generationCount: 1,
    generationSetDigest: digestV1("9"),
    acceptedGenerationFloors: {
      rootMetadataGeneration: 1,
      registryManifestGeneration: 1,
      supportCatalogGeneration: 1,
    },
  });
  return ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate",
    locatorProfile: "installation_provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
    contentDigest:
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1(payload),
    currentVersionToken: tokenV1("c"),
    payload,
  });
}

function receiptUnsignedV1(
  state: ProviderStrongReadyAcceptanceStateUnsignedCandidateV1,
  highWater: ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1 {
  const candidate = acceptanceEnvelopeV1(state);
  const request = ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema.parse({
    profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_request_reference_candidate_v1",
    operationNonce: "b".repeat(32),
    installationIdentityGenerationId:
      state.installationIdentityGenerationId,
    expected: { state: "genesis", expectedNamespaceState: "absent" },
    candidate,
  });
  const appendedGeneration =
    ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema.parse({
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: 1,
      generationId: candidate.generationId,
      contentDigest: candidate.contentDigest,
      commitOperationNonce: request.operationNonce,
      predecessor: candidate.payload.predecessor,
    });
  return ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1Schema.parse({
    profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1",
    installationIdentityGenerationId:
      state.installationIdentityGenerationId,
    operationNonce: request.operationNonce,
    requestContentDigest:
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
        request,
      ),
    linearizationOrdinal: 1,
    requestReferenceProjection: request,
    referenceOutcome: {
      outcome: "committed",
      committedHighWater: highWater,
      appendedGeneration,
    },
    resolvedAt: "2026-08-13T03:00:01Z",
  });
}

function expectCapabilityErrorV1(error: unknown): boolean {
  expect(error).toBeInstanceOf(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1,
  );
  expect(error).toMatchObject({
    name: "ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1",
    message: "provider Acceptance identity verification failed",
    stage: "identity_verification_capability",
    reason: "capability_invalid",
  });
  expect(Object.isFrozen(error)).toBe(true);
  return true;
}

describe("D-40 Acceptance identity-verification capability internal", () => {
  it("verifies an exact Acceptance envelope through the consume-only public capability seam", async () => {
    const capability = await mintV1();
    const state = acceptanceStateV1();
    const token =
      await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        state,
      );

    await expect(
      verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1(
        capability,
        acceptanceEnvelopeV1(state, token),
      ),
    ).resolves.toBe(true);
  });

  it("rejects a tampered Acceptance token through the consume-only public capability seam", async () => {
    const capability = await mintV1();
    const state = acceptanceStateV1();

    await expect(
      verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1(
        capability,
        acceptanceEnvelopeV1(state, tokenV1("0")),
      ),
    ).resolves.toBe(false);
  });

  it("mints a reusable frozen null-prototype zero-key shell only for the exact recomputed tuple", async () => {
    const capability = await mintV1();
    expect(Object.getPrototypeOf(capability)).toBeNull();
    expect(Object.isFrozen(capability)).toBe(true);
    expect(Reflect.ownKeys(capability)).toEqual([]);
    expect(
      getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1(
        capability,
      ),
    ).toBe(INSTALLATION_IDENTITY_GENERATION_ID_V1);
    expect(() =>
      assertProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
      )
    ).not.toThrow();

    const state = acceptanceStateV1();
    const first =
      await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        state,
      );
    const second =
      await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        state,
      );
    expect(second).toBe(first);
  });

  it.each([
    ["extra mint field", { extra: true }],
    [
      "wrong generation",
      {
        installationIdentityGenerationId:
          `installation-identity-generation:${"0".repeat(22)}`,
      },
    ],
    ["wrong key check", { keyCheckToken: tokenV1("0") }],
    ["short key", { installationIdentityKey: new Uint8Array(31) }],
    [
      "inexact crypto host",
      { cryptoHost: { ...cryptoHostV1(), extra: true } },
    ],
  ])("rejects %s before minting authority", async (_label, overrides) => {
    await expect(mintV1(overrides)).rejects.toSatisfy(expectCapabilityErrorV1);
  });

  it("rejects getters without invoking them", async () => {
    let invoked = false;
    const input = Object.defineProperty(
      {
        initializationNonce: INITIALIZATION_NONCE_V1,
        installationIdentityGenerationId:
          INSTALLATION_IDENTITY_GENERATION_ID_V1,
        keyCheckToken: INSTALLATION_IDENTITY_KEY_CHECK_TOKEN_V1,
        installationIdentityKey: INSTALLATION_IDENTITY_KEY_V1.slice(),
        cryptoHost: cryptoHostV1(),
      },
      "initializationNonce",
      {
        enumerable: true,
        get() {
          invoked = true;
          return INITIALIZATION_NONCE_V1;
        },
      },
    );
    await expect(
      mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1(
        input as never,
      ),
    ).rejects.toSatisfy(expectCapabilityErrorV1);
    expect(invoked).toBe(false);
  });

  it("defensively copies the key and captures the exact crypto methods", async () => {
    const key = INSTALLATION_IDENTITY_KEY_V1.slice();
    const original = cryptoHostV1();
    const host: ProviderCryptoHostV1 = {
      sha256: original.sha256,
      hmacSha256: original.hmacSha256,
    };
    const capability = await mintV1({
      installationIdentityKey: key,
      cryptoHost: host,
    });
    key.fill(0xff);
    host.sha256 = () => new Uint8Array(32);
    host.hmacSha256 = () => new Uint8Array(32);

    const state = acceptanceStateV1();
    await expect(
      deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        state,
      ),
    ).resolves.toBe(
      expectedTokenV1(PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1, state),
    );
  });

  it("rejects clones, lookalikes, foreign handles, and wrong Identity tuples before HMAC", async () => {
    const hmac = vi.fn(cryptoHostV1().hmacSha256);
    const capability = await mintV1({
      cryptoHost: { sha256: cryptoHostV1().sha256, hmacSha256: hmac },
    });
    hmac.mockClear();
    const state = acceptanceStateV1();
    const invalidHandles = [
      {},
      Object.freeze(Object.create(null)),
      structuredClone(capability),
    ];
    for (const invalid of invalidHandles) {
      await expect(
        deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
          invalid,
          INSTALLATION_IDENTITY_GENERATION_ID_V1,
          state,
        ),
      ).rejects.toSatisfy(expectCapabilityErrorV1);
    }
    await expect(
      deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        capability,
        `installation-identity-generation:${"f".repeat(22)}`,
        state,
      ),
    ).rejects.toSatisfy(expectCapabilityErrorV1);
    expect(hmac).not.toHaveBeenCalled();
  });

  it("derives and verifies state, current-version, and receipt tokens from their exact reference-Candidate projections", async () => {
    const capability = await mintV1();
    const state = acceptanceStateV1();
    const highWater = highWaterEnvelopeV1(state);
    const receipt = receiptUnsignedV1(state, highWater);

    const stateToken =
      await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        state,
      );
    const currentToken =
      await deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        highWater,
      );
    const receiptToken =
      await deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        receipt,
      );

    expect(stateToken).toBe(
      expectedTokenV1(PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1, state),
    );
    expect(currentToken).toBe(expectedTokenV1(
      PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_CURRENT_VERSION_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
      projectProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1(highWater),
    ));
    expect(receiptToken).toBe(expectedTokenV1(
      PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
      projectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1(
        receipt,
      ),
    ));

    await expect(
      verifyProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        { ...state, acceptanceToken: stateToken },
        stateToken,
      ),
    ).resolves.toBe(true);
    await expect(
      verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        { ...highWater, currentVersionToken: currentToken },
        currentToken,
      ),
    ).resolves.toBe(true);
    const signedReceipt =
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.parse({
        ...receipt,
        receiptToken,
      });
    await expect(
      verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        signedReceipt,
        receiptToken,
      ),
    ).resolves.toBe(true);
    await expect(
      verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        signedReceipt,
        tokenV1("0"),
      ),
    ).resolves.toBe(false);
  });

  it("rejects a cross-Identity projection and cross-Identity capability substitution", async () => {
    const capability = await mintV1();
    const state = acceptanceStateV1();
    const otherIdentityState = {
      ...state,
      installationIdentityGenerationId:
        `installation-identity-generation:${"f".repeat(22)}`,
    };
    await expect(
      deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        otherIdentityState,
      ),
    ).rejects.toSatisfy(expectCapabilityErrorV1);

    const otherNonce = "f".repeat(32);
    const otherKey = new Uint8Array(32).fill(0xa5);
    const otherGenerationDigest = createHash("sha256")
      .update(new TextEncoder().encode(canonicalizeJcsSafeIntegerV1([
        INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
        { initializationNonce: otherNonce },
      ])))
      .digest("hex");
    const otherGenerationId =
      `installation-identity-generation:${otherGenerationDigest.slice(0, 22)}`;
    const otherKeyCheck = expectedTokenV1(
      INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1,
      { generationId: otherGenerationId, initializationNonce: otherNonce },
      otherKey,
    );
    const otherCapability =
      await mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1({
        initializationNonce: otherNonce,
        installationIdentityGenerationId: otherGenerationId,
        keyCheckToken: otherKeyCheck,
        installationIdentityKey: otherKey,
        cryptoHost: cryptoHostV1(),
      } as never);
    await expect(
      deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        otherCapability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        state,
      ),
    ).rejects.toSatisfy(expectCapabilityErrorV1);
  });

  it("does not late-bind mutable TextEncoder, string, typed-array, or host properties after initialization", async () => {
    const capability = await mintV1();
    const state = acceptanceStateV1();
    const expected = expectedTokenV1(
      PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
      state,
    );
    const candidates = [
      { owner: globalThis, key: "TextEncoder" },
      { owner: Object, key: "getOwnPropertyDescriptor" },
      { owner: Reflect, key: "apply" },
    ] as const;
    const originals = candidates.map((entry) => {
      const descriptor = Object.getOwnPropertyDescriptor(
        entry.owner,
        entry.key,
      );
      if (descriptor === undefined) throw new TypeError("primordial missing");
      return { ...entry, descriptor };
    });
    try {
      for (const entry of candidates) {
        Object.defineProperty(entry.owner, entry.key, {
          configurable: true,
          writable: true,
          value() {
            throw new Error(`poisoned ${entry.key}`);
          },
        });
      }
      await expect(
        deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
          capability,
          INSTALLATION_IDENTITY_GENERATION_ID_V1,
          state,
        ),
      ).resolves.toBe(expected);
    } finally {
      for (const entry of originals) {
        Object.defineProperty(entry.owner, entry.key, entry.descriptor);
      }
    }

    const charCodeAtDescriptor = Object.getOwnPropertyDescriptor(
      String.prototype,
      "charCodeAt",
    );
    if (charCodeAtDescriptor === undefined) {
      throw new TypeError("charCodeAt primordial missing");
    }
    const poisonedCharCodeAt = vi.fn(() => {
      throw new Error("poisoned charCodeAt");
    });
    Object.defineProperty(String.prototype, "charCodeAt", {
      configurable: true,
      writable: true,
      value: poisonedCharCodeAt,
    });
    try {
      await expect(
        deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
          capability,
          INSTALLATION_IDENTITY_GENERATION_ID_V1,
          state,
        ),
      ).resolves.toBe(expected);
      expect(poisonedCharCodeAt).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(
        String.prototype,
        "charCodeAt",
        charCodeAtDescriptor,
      );
    }
  });

  it("snapshots unsigned inputs before an asynchronous host can observe caller mutation", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = cryptoHostV1();
    let hmacCallCount = 0;
    const capability = await mintV1({
      cryptoHost: {
        sha256: base.sha256,
        async hmacSha256(key: Uint8Array, message: Uint8Array) {
          hmacCallCount += 1;
          if (hmacCallCount === 1) return base.hmacSha256(key, message);
          await gate;
          return base.hmacSha256(key, message);
        },
      },
    });
    const state = acceptanceStateV1();
    const expected = expectedTokenV1(
      PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
      state,
    );
    const operation =
      deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        capability,
        INSTALLATION_IDENTITY_GENERATION_ID_V1,
        state,
      );
    (state as { acceptedAt: string }).acceptedAt = "2026-08-13T03:00:59Z";
    release();
    await expect(operation).resolves.toBe(expected);
  });
});
