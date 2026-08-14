import { describe, expect, it, vi } from "vitest";

import {
  PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_REQUEST_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_CURRENT_VERSION_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_GENERATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendOutcomeReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceObservedHighWaterReferenceCandidateV1Schema,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1,
  projectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1,
  projectProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import {
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "../src/provider-strong-ready-acceptance-candidate.js";

function digestV1(value: string) {
  return `sha256:${value.repeat(64)}`;
}

function tokenV1(value: string) {
  return `hmac-sha256:${value.repeat(64)}`;
}

function cloneJsonV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function acceptanceEnvelopeV1(
  acceptanceOrdinal = 1,
  predecessor:
    | { state: "genesis" }
    | {
        state: "acceptance";
        generationId: string;
        contentDigest: string;
      } = { state: "genesis" },
): ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1 {
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
        locatorProfile: "installation_provider_registry_manifest_v1" as const,
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
        selections: [
          {
            targetProfileId: `provider-target-profile:${"4".repeat(64)}`,
            providerId: "durable-object-provider:wire-test",
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
          },
        ],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
  const installationIdentityGenerationId =
    `installation-identity-generation:${"a".repeat(22)}`;
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1(
    {
      installationIdentityGenerationId,
      acceptanceOrdinal,
      predecessor,
      configuration,
    },
  );
  const payload = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId,
    acceptanceOrdinal,
    predecessor,
    configuration,
    acceptedAt: "2026-08-13T03:00:00Z",
    acceptanceToken: tokenV1("a"),
  };
  return ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId,
    acceptedAt: payload.acceptedAt,
    contentDigest:
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload),
    payload,
  });
}

function entryV1(
  candidate: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
  commitOperationNonce = "b".repeat(32),
): ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1 {
  return ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema.parse({
    locatorProfile: "installation_provider_acceptance_state_v1",
    acceptanceOrdinal: candidate.payload.acceptanceOrdinal,
    generationId: candidate.generationId,
    contentDigest: candidate.contentDigest,
    commitOperationNonce,
    predecessor: candidate.payload.predecessor,
  });
}

function enumerationV1(
  entries: ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1[],
): ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1 {
  return ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema.parse({
    profile: "provider_strong_ready_bootstrap_or_steady_acceptance_generation_enumeration_reference_candidate_v1",
    installationIdentityGenerationId:
      "installation-identity-generation:" + "a".repeat(22),
    namespaceRevision: entries.length,
    entries,
    generationCount: entries.length,
    generationSetDigest:
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1({ entries }),
  });
}

function highWaterV1(
  candidate: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
  generationSetDigest: string,
  operationNonce = "b".repeat(32),
  predecessor:
    | { state: "genesis"; expectedNamespaceState: "absent" }
    | {
        state: "version";
        highWaterRevision: number;
        contentDigest: string;
        currentVersionToken: string;
      } = { state: "genesis", expectedNamespaceState: "absent" },
): ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1 {
  const payload = ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema.parse({
    profile: "provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
    installationIdentityGenerationId:
      candidate.installationIdentityGenerationId,
    highWaterRevision: candidate.payload.acceptanceOrdinal,
    operationNonce,
    predecessor,
    currentAcceptance: {
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: candidate.payload.acceptanceOrdinal,
      generationId: candidate.generationId,
      contentDigest: candidate.contentDigest,
    },
    generationCount: candidate.payload.acceptanceOrdinal,
    generationSetDigest,
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

function genesisRequestV1(
  candidate = acceptanceEnvelopeV1(),
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1 {
  return ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema.parse({
    profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_request_reference_candidate_v1",
    operationNonce: "b".repeat(32),
    installationIdentityGenerationId:
      candidate.installationIdentityGenerationId,
    expected: { state: "genesis", expectedNamespaceState: "absent" },
    candidate,
  });
}

function committedReceiptV1(): {
  receipt: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1;
  envelope: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1;
  enumeration: ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1;
  highWater: ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1;
} {
  const request = genesisRequestV1();
  const entry = entryV1(request.candidate, request.operationNonce);
  const enumeration = enumerationV1([entry]);
  const highWater = highWaterV1(
    request.candidate,
    enumeration.generationSetDigest,
    request.operationNonce,
  );
  const unsigned = {
    profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1" as const,
    installationIdentityGenerationId:
      request.installationIdentityGenerationId,
    operationNonce: request.operationNonce,
    linearizationOrdinal: 1,
    requestContentDigest:
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
        request,
      ),
    requestReferenceProjection: cloneJsonV1(request),
    referenceOutcome: {
      outcome: "committed" as const,
      committedHighWater: cloneJsonV1(highWater),
      appendedGeneration: cloneJsonV1(entry),
    },
    resolvedAt: "2026-08-13T03:00:01Z",
  };
  const receipt = ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema
    .parse({ ...unsigned, receiptToken: tokenV1("d") });
  const envelope =
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate",
      locatorProfile:
        "installation_provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1",
      installationIdentityGenerationId:
        receipt.installationIdentityGenerationId,
      operationNonce: receipt.operationNonce,
      resolvedAt: receipt.resolvedAt,
      contentDigest:
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
          receipt,
        ),
      payload: cloneJsonV1(receipt),
    });
  return { receipt, envelope, enumeration, highWater };
}

describe("D-40 Acceptance compare-append reference Candidate wire", () => {
  it("freezes the exact reference-candidate digest and owner-HMAC domains", () => {
    expect([
      PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_REQUEST_REFERENCE_CANDIDATE_DOMAIN_V1,
      PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_GENERATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
      PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
      PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_CURRENT_VERSION_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
      PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_REFERENCE_CANDIDATE_DOMAIN_V1,
      PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
    ]).toEqual([
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-request-reference-candidate-v1",
      "provider-strong-ready-bootstrap-or-steady-acceptance-generation-set-reference-candidate-v1",
      "provider-strong-ready-bootstrap-or-steady-acceptance-high-water-reference-candidate-v1",
      "provider-strong-ready-bootstrap-or-steady-acceptance-current-version-token-reference-candidate-v1",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-receipt-reference-candidate-v1",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-receipt-token-reference-candidate-v1",
    ]);
  });

  it("parses the twelve reference Candidate schemas across a committed genesis closure", () => {
    const { receipt, envelope, enumeration, highWater } =
      committedReceiptV1();
    const request = receipt.requestReferenceProjection;
    const entry = enumeration.entries[0]!;
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema.parse(
        entry,
      ),
    ).toEqual(entry);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema.parse(
        enumeration,
      ),
    ).toEqual(enumeration);
    expect(ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema.parse(highWater.payload))
      .toEqual(highWater.payload);
    expect(ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema.parse(highWater))
      .toEqual(highWater);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema.parse({
        profile: "provider_strong_ready_bootstrap_or_steady_acceptance_current_read_reference_candidate_v1",
        highWater,
        enumeration,
      }),
    ).toBeDefined();
    expect(ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema.parse(request))
      .toEqual(request);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceObservedHighWaterReferenceCandidateV1Schema.parse({
        state: "trusted",
        highWater,
      }),
    ).toBeDefined();
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendOutcomeReferenceCandidateV1Schema.parse(
        receipt.referenceOutcome,
      ),
    ).toEqual(receipt.referenceOutcome);
    expect(ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.parse(receipt))
      .toEqual(receipt);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema.parse(
        envelope,
      ),
    ).toEqual(envelope);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1Schema.parse(
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1(envelope),
      ),
    ).toBeDefined();
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1Schema.parse({
        resolution: "resolved",
        receipt: envelope,
      }),
    ).toBeDefined();
  });

  it("keeps the reference receipt at exactly nine fields and derives its unsigned projection and pin", () => {
    const { receipt, envelope } = committedReceiptV1();
    expect(Object.keys(receipt).sort()).toEqual([
      "installationIdentityGenerationId",
      "linearizationOrdinal",
      "operationNonce",
      "profile",
      "receiptToken",
      "referenceOutcome",
      "requestContentDigest",
      "requestReferenceProjection",
      "resolvedAt",
    ]);
    const unsigned =
      projectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1(
        receipt,
      );
    expect(Object.keys(unsigned).sort()).toEqual([
      "installationIdentityGenerationId",
      "linearizationOrdinal",
      "operationNonce",
      "profile",
      "referenceOutcome",
      "requestContentDigest",
      "requestReferenceProjection",
      "resolvedAt",
    ]);
    expect(Object.isFrozen(unsigned)).toBe(true);
    expect(unsigned.linearizationOrdinal).toBe(1);
    const pin =
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1(envelope);
    expect(Object.getPrototypeOf(pin)).toBe(Object.prototype);
    expect(Object.isFrozen(pin)).toBe(true);
    expect(pin).toEqual({
      locatorProfile:
        "installation_provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1",
      installationIdentityGenerationId:
        receipt.installationIdentityGenerationId,
      operationNonce: receipt.operationNonce,
      contentDigest: envelope.contentDigest,
      receiptToken: receipt.receiptToken,
    });
    expect(() =>
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.parse({
        ...receipt,
        tenthField: true,
      }),
    ).toThrow();
  });

  it("binds the 1..4096 linearization ordinal into the signed receipt projection", () => {
    const { receipt, envelope } = committedReceiptV1();
    const lastAllowed =
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.parse({
        ...receipt,
        linearizationOrdinal: 4_096,
      });
    expect(lastAllowed.linearizationOrdinal).toBe(4_096);
    expect(
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
        lastAllowed,
      ),
    ).not.toBe(envelope.contentDigest);

    for (const linearizationOrdinal of [0, 4_097]) {
      expect(
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.safeParse({
          ...receipt,
          linearizationOrdinal,
        }).success,
      ).toBe(false);
    }
  });

  it("enforces complete enumeration order, predecessor, count, and set digest", () => {
    const first = acceptanceEnvelopeV1();
    const second = acceptanceEnvelopeV1(2, {
      state: "acceptance",
      generationId: first.generationId,
      contentDigest: first.contentDigest,
    });
    const entries = [entryV1(first), entryV1(second, "c".repeat(32))];
    const valid = enumerationV1(entries);
    expect(valid.generationCount).toBe(2);

    for (const malformed of [
      { ...valid, generationCount: 1 },
      { ...valid, namespaceRevision: 1 },
      { ...valid, generationSetDigest: digestV1("f") },
      {
        ...valid,
        entries: [valid.entries[0], valid.entries[0]],
        generationCount: 2,
        namespaceRevision: 2,
      },
    ]) {
      expect(
        ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema.safeParse(
          malformed,
        ).success,
      ).toBe(false);
    }
    const reversed = [...valid.entries].reverse();
    const reverseWithMatchingDigest = {
      ...valid,
      entries: reversed,
      generationSetDigest:
        // Compute the raw domain digest through the public derivation only for
        // a well-formed set; malformed order must be rejected before hashing.
        valid.generationSetDigest,
    };
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema.safeParse(
        reverseWithMatchingDigest,
      ).success,
    ).toBe(false);
  });

  it("binds high-water/current claims and projects exactly the owner-token fields", () => {
    const { enumeration, highWater } = committedReceiptV1();
    const current = ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema.parse({
      profile: "provider_strong_ready_bootstrap_or_steady_acceptance_current_read_reference_candidate_v1",
      highWater,
      enumeration,
    });
    expect(current.highWater.payload.generationSetDigest).toBe(
      current.enumeration.generationSetDigest,
    );
    const fields =
      projectProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1(
        highWater,
      );
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1Schema.parse(
        fields,
      ),
    ).toEqual(fields);
    expect(Object.keys(fields).sort()).toEqual([
      "currentAcceptance",
      "generationCount",
      "generationSetDigest",
      "highWaterContentDigest",
      "highWaterRevision",
      "installationIdentityGenerationId",
      "locatorProfile",
    ]);

    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema.safeParse({
        ...current,
        enumeration: {
          ...enumeration,
          generationSetDigest: digestV1("f"),
        },
      }).success,
    ).toBe(false);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema.safeParse({
        ...highWater,
        contentDigest: digestV1("f"),
      }).success,
    ).toBe(false);
  });

  it("binds request, candidate, committed outcome, and receipt projections", () => {
    const { receipt } = committedReceiptV1();
    const request = receipt.requestReferenceProjection;
    const requestDigest =
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
        request,
      );
    expect(requestDigest).toBe(receipt.requestContentDigest);

    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema.safeParse({
        ...request,
        installationIdentityGenerationId:
          "installation-identity-generation:" + "f".repeat(22),
      }).success,
    ).toBe(false);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema.safeParse({
        ...request,
        candidate: {
          ...request.candidate,
          contentDigest: digestV1("f"),
        },
      }).success,
    ).toBe(false);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.safeParse({
        ...receipt,
        requestContentDigest: digestV1("f"),
      }).success,
    ).toBe(false);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.safeParse({
        ...receipt,
        referenceOutcome: {
          ...receipt.referenceOutcome,
          appendedGeneration: {
            ...(receipt.referenceOutcome.outcome === "committed"
              ? receipt.referenceOutcome.appendedGeneration
              : {}),
            commitOperationNonce: "f".repeat(32),
          },
        },
      }).success,
    ).toBe(false);
  });

  it("accepts only the reference integrity-failure observation pairing", () => {
    const request = genesisRequestV1();
    const common = {
      profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1" as const,
      installationIdentityGenerationId:
        request.installationIdentityGenerationId,
      operationNonce: request.operationNonce,
      linearizationOrdinal: 1,
      requestContentDigest:
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
          request,
        ),
      requestReferenceProjection: request,
      resolvedAt: "2026-08-13T03:00:01Z",
      receiptToken: tokenV1("d"),
    };
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.parse({
        ...common,
        referenceOutcome: {
          outcome: "not_committed",
          reason: "namespace_integrity_failed",
          observedHighWater: {
            state: "integrity_failed",
            evidenceDigest: digestV1("e"),
          },
        },
      }),
    ).toBeDefined();
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.safeParse({
        ...common,
        referenceOutcome: {
          outcome: "not_committed",
          reason: "candidate_invalid",
          observedHighWater: {
            state: "integrity_failed",
            evidenceDigest: digestV1("e"),
          },
        },
      }).success,
    ).toBe(false);
  });

  it("rejects hostile descriptors and unknown fields before digesting", () => {
    const request = genesisRequestV1();
    const getter = vi.fn(() => request.operationNonce);
    const hostile = Object.create(null) as Record<string, unknown>;
    for (const [key, value] of Object.entries(request)) hostile[key] = value;
    Object.defineProperty(hostile, "operationNonce", {
      enumerable: true,
      get: getter,
    });
    expect(() =>
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
        hostile,
      ),
    ).toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(() =>
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1({
        ...request,
        extra: true,
      }),
    ).toThrow();
    const proxyGetter = vi.fn(() => request.operationNonce);
    expect(() =>
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
        new Proxy(request, {
          getOwnPropertyDescriptor(target, property) {
            if (property === "operationNonce") {
              return {
                enumerable: true,
                configurable: true,
                get: proxyGetter,
              };
            }
            return Reflect.getOwnPropertyDescriptor(target, property);
          },
        }),
      ),
    ).toThrow();
    expect(proxyGetter).not.toHaveBeenCalled();
  });

  it("uses captured TextEncoder, typed-array byteLength, and string-slice primordials after import", () => {
    const request = genesisRequestV1();
    const expected =
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
        request,
      );
    const textEncoderDescriptor = Object.getOwnPropertyDescriptor(
      TextEncoder.prototype,
      "encode",
    )!;
    const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
    const byteLengthDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "byteLength",
    )!;
    const stringSliceDescriptor = Object.getOwnPropertyDescriptor(
      String.prototype,
      "slice",
    )!;
    const poison = vi.fn(() => {
      throw new TypeError("late-bound primordial");
    });
    let actual: unknown;
    try {
      Object.defineProperty(TextEncoder.prototype, "encode", {
        ...textEncoderDescriptor,
        value: poison,
      });
      Object.defineProperty(typedArrayPrototype, "byteLength", {
        ...byteLengthDescriptor,
        get: poison,
      });
      Object.defineProperty(String.prototype, "slice", {
        ...stringSliceDescriptor,
        value: poison,
      });
      actual =
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
          request,
        );
    } finally {
      Object.defineProperty(
        TextEncoder.prototype,
        "encode",
        textEncoderDescriptor,
      );
      Object.defineProperty(
        typedArrayPrototype,
        "byteLength",
        byteLengthDescriptor,
      );
      Object.defineProperty(String.prototype, "slice", stringSliceDescriptor);
    }
    expect(actual).toBe(expected);
    expect(poison).not.toHaveBeenCalled();
  });
});
