import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import type { ProviderCryptoHostV1 } from "../src/domain-crypto.js";
import type {
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "../src/provider-distribution-history-current-candidate-point.js";
import {
  createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-reference-candidate.js";
import type {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import {
  deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import {
  createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1,
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-machine-internal.js";
import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-real-filesystem-source-fixtures.js";
import {
  LowerHex32V1Schema,
} from "../src/primitives.js";
import {
  deriveInstallationIdentityKeyCheckTokenV1,
} from "../src/provider-foundation.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
} from "../src/provider-registry-trust.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-registry-manifest-fixtures.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-registry-root-history-fixtures.js";
import {
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "../src/provider-strong-ready-acceptance-candidate.js";
import {
  deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1,
} from "../src/provider-trusted-local-strong-writer-selection-candidate-internal.js";
import {
  selectProviderTrustedLocalPhysicalTargetCandidateV1,
  type ProviderTrustedLocalPhysicalTargetObservationCapabilityV1,
} from "../src/provider-trusted-local-physical-target-selection-candidate.js";
import {
  mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1,
} from "../src/provider-trusted-local-physical-target-observation-capability-internal.js";
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
  buildProviderStrongReadyAcceptanceMultiTargetRawRequestFixture,
  type ProviderStrongReadyAcceptanceMultiTargetRawRequestFixtureV1,
} from "../scripts/lib/provider-strong-ready-acceptance-candidate-fixture.mjs";

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

function resourceJson(relativePath: string): unknown {
  return JSON.parse(new TextDecoder().decode(resourceBytes(relativePath)));
}

function cloneJsonV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const cryptoHost: ProviderCryptoHostV1 = Object.freeze({
  sha256(message: Uint8Array) {
    return new Uint8Array(createHash("sha256").update(message).digest());
  },
  hmacSha256(key: Uint8Array, message: Uint8Array) {
    return new Uint8Array(
      createHmac("sha256", key).update(message).digest(),
    );
  },
});
const initializationNonce = LowerHex32V1Schema.parse("a1".repeat(16));
const installationIdentityKey = new Uint8Array(
  Array.from({ length: 32 }, (_value, index) => index),
);
const acceptedAt = ProviderRegistryIsoTimestampV1Schema.parse(
  "2026-08-13T02:00:00Z",
);
const resolvedAt = ProviderRegistryIsoTimestampV1Schema.parse(
  "2026-08-13T02:00:01Z",
);
let strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
let multiTargetDistributionRawRequest:
  ProviderStrongReadyAcceptanceMultiTargetRawRequestFixtureV1;

beforeAll(async () => {
  const strictManifestBytes = resourceBytes(
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  );
  strictCryptoCapability = await attestProviderStrictEd25519CryptoHostV1({
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
  multiTargetDistributionRawRequest =
    buildProviderStrongReadyAcceptanceMultiTargetRawRequestFixture({
      rootGolden: resourceJson(
        PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
      ),
      registryGolden: resourceJson(
        PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
      ),
      sourceGolden: resourceJson(
        PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
      ),
    });
});

function distributionInputV1():
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input {
  return {
    ...cloneJsonV1(multiTargetDistributionRawRequest),
    strictCryptoCapability,
  };
}

function mintObservationCapabilityV1(
  target: unknown,
  witnessByte: number,
): Promise<ProviderTrustedLocalPhysicalTargetObservationCapabilityV1> {
  return mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
    {
      openedRootAuthority: Object.freeze({}),
      physicalTargetObservationHost: Object.freeze({
        observeOpenedRootPhysicalTargetV1() {
          return {
            target,
            rootVolumeContinuityWitness: new Uint8Array([witnessByte]),
          };
        },
      }),
    },
  ) as Promise<ProviderTrustedLocalPhysicalTargetObservationCapabilityV1>;
}

describe("D-40 public closure with real D-39 signed multi-target selection", () => {
  it("commits a Registry-exact singleton writer selected from the non-first local target", async () => {
    const distributionForDerivation = distributionInputV1();
    const observedTarget = structuredClone(
      distributionForDerivation.releaseTargetUniverseHistory.at(-1)!
        .payload.targets[1]!.target,
    );
    const derivedD39 =
      await selectProviderTrustedLocalPhysicalTargetCandidateV1({
        distributionHistoryCandidate: distributionForDerivation,
        physicalTargetObservationCapability:
          await mintObservationCapabilityV1(observedTarget, 0x40),
      });
    expect(
      derivedD39.distributionHistoryCandidate.currentCatalogProjection
        .targetCount,
    ).toBe(2);
    const selectedWriter =
      deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
        derivedD39,
      ).selectedActiveWriter;

    const installationIdentityGenerationId = derivedD39
      .distributionHistoryCandidate.catalogPointClosure
      .registryManifestHistoryClosure.installationIdentityGenerationId;
    const identityCapability =
      await mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1({
        initializationNonce,
        installationIdentityGenerationId,
        keyCheckToken:
          await deriveInstallationIdentityKeyCheckTokenV1(
            {
              generationId: installationIdentityGenerationId,
              initializationNonce,
            },
            installationIdentityKey,
            cryptoHost,
          ),
        installationIdentityKey: installationIdentityKey.slice(),
        cryptoHost,
      });
    const referenceMachineCapability =
      await mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
        identityVerificationCapability: identityCapability,
        initialState: {
          namespace: { state: "absent" },
          receiptLedger:
            createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1(
              {
                installationIdentityGenerationId,
                receipts: [],
              },
            ),
        },
        retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
      });
    const registryClosure = derivedD39.distributionHistoryCandidate
      .catalogPointClosure.registryManifestHistoryClosure;
    const configuration = {
      state: "strong_ready" as const,
      core: {
        activeRootMetadata: registryClosure.currentRootMetadata,
        providerRegistryManifest: registryClosure.currentRegistryManifest,
        providerSupportCatalog:
          derivedD39.providerFeasibilitySupportCatalogPin,
        activeWriterSelector: {
          profile: "provider_active_writer_selector_v1" as const,
          selections: [selectedWriter],
        },
      },
      activation: { origin: "bootstrap_or_steady_successor" as const },
    };
    const generationId =
      deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
        installationIdentityGenerationId,
        acceptanceOrdinal: 1,
        predecessor: { state: "genesis" },
        configuration,
      });
    const unsigned = {
      profile: "provider_acceptance_state_v1" as const,
      generationId,
      installationIdentityGenerationId,
      acceptanceOrdinal: 1,
      predecessor: { state: "genesis" as const },
      configuration,
      acceptedAt,
    };
    const payload = {
      ...unsigned,
      acceptanceToken:
        await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
          identityCapability,
          installationIdentityGenerationId,
          unsigned,
        ),
    };
    const candidate = {
      schemaVersion: 1 as const,
      recordType: "provider_acceptance_state" as const,
      generationId,
      installationIdentityGenerationId,
      acceptedAt,
      contentDigest:
        deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload),
      payload,
    };
    const request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1 = {
      profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_request_reference_candidate_v1",
      operationNonce: LowerHex32V1Schema.parse("40".repeat(16)),
      installationIdentityGenerationId,
      expected: { state: "genesis", expectedNamespaceState: "absent" },
      candidate,
    };

    const result =
      await createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1({
        distributionHistoryCandidate: distributionInputV1(),
        physicalTargetObservationCapability:
          await mintObservationCapabilityV1(observedTarget, 0x41),
        acceptanceCompareAppendRequest: request,
        resolvedAt,
        identityVerificationCapability: identityCapability,
        referenceMachineCapability,
      });
    expect(result.compareAppendResult).toMatchObject({
      resolution: "resolved",
      receipt: {
        payload: { referenceOutcome: { outcome: "committed" } },
      },
    });
    expect(
      result.acceptanceCompareAppendRequest.candidate.payload.configuration
        .core.activeWriterSelector.selections,
    ).toEqual([selectedWriter]);
    expect(selectedWriter.targetProfileId).toBe(observedTarget.targetProfileId);
  });
});
