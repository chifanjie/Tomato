import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type {
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "../src/provider-distribution-history-current-candidate-point.js";
import {
  PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_PATH_V1,
  materializeProviderDistributionHistoryCurrentCandidatePointPositiveVectorRequestV1,
  verifyProviderDistributionHistoryCurrentCandidatePointGoldenResourceV1,
} from "../src/provider-distribution-history-current-candidate-point-fixtures.js";
import { ContentDigestV1Schema } from "../src/primitives.js";
import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-real-filesystem-source-fixtures.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-registry-manifest-fixtures.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-registry-root-history-fixtures.js";
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
  deriveProviderTargetProfileIdV1,
} from "../src/provider-target-discovery-point.js";
import {
  PROVIDER_TRUSTED_LOCAL_PHYSICAL_TARGET_SELECTION_CANDIDATE_AUTHORITY_V1,
  ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationError,
  diagnoseProviderTrustedLocalPhysicalTargetCandidateV1,
  selectProviderTrustedLocalPhysicalTargetCandidateV1,
  type ProviderTrustedLocalPhysicalTargetObservationCapabilityV1,
} from "../src/provider-trusted-local-physical-target-selection-candidate.js";
import {
  mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1,
} from "../src/provider-trusted-local-physical-target-observation-capability-internal.js";
import {
  buildProviderStrongReadyAcceptanceSingleTargetRawRequestFixture,
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

let strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
let rawRequest: Omit<
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
  "strictCryptoCapability"
>;
const multiTargetDistributionGolden =
  verifyProviderDistributionHistoryCurrentCandidatePointGoldenResourceV1(
    resourceBytes(
      PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_POINT_GOLDEN_RESOURCE_PATH_V1,
    ),
  );

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
  rawRequest = buildProviderStrongReadyAcceptanceSingleTargetRawRequestFixture({
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
    ...cloneJsonV1(rawRequest),
    strictCryptoCapability,
  };
}

function targetV1() {
  return cloneJsonV1(
    rawRequest.releaseTargetUniverseHistory[0]!.payload.targets[0]!.target,
  );
}

function targetWithBuildDigestV1(contentDigest: string) {
  const target = targetV1();
  target.osBuildDigest = ContentDigestV1Schema.parse(contentDigest);
  target.targetProfileId = deriveProviderTargetProfileIdV1({
    osPlatform: target.osPlatform,
    osReleaseFamilyCode: target.osReleaseFamilyCode,
    osBuildDigest: target.osBuildDigest,
    architecture: target.architecture,
    filesystemProfileCode: target.filesystemProfileCode,
    filesystemFeatureProfileDigest:
      target.filesystemFeatureProfileDigest,
    mountOptionProfileDigest: target.mountOptionProfileDigest,
  });
  return target;
}

function observationV1(target = targetV1(), witnessByte = 0x39) {
  return {
    target,
    rootVolumeContinuityWitness: new Uint8Array([witnessByte]),
  };
}

async function mintCapabilityV1(
  observe: () => unknown | Promise<unknown> = () => observationV1(),
): Promise<ProviderTrustedLocalPhysicalTargetObservationCapabilityV1> {
  return await mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
    {
      openedRootAuthority: Object.freeze({}),
      physicalTargetObservationHost: Object.freeze({
        observeOpenedRootPhysicalTargetV1: observe,
      }),
    },
  ) as ProviderTrustedLocalPhysicalTargetObservationCapabilityV1;
}

describe("Provider trusted local physical-target selection candidate", () => {
  it("projects one trusted local target from a legal multi-target Distribution closure", async () => {
    const distributionHistoryCandidate =
      materializeProviderDistributionHistoryCurrentCandidatePointPositiveVectorRequestV1(
        multiTargetDistributionGolden,
        "genesis",
        strictCryptoCapability,
      );
    const observedTarget = cloneJsonV1(
      distributionHistoryCandidate.releaseTargetUniverseHistory.at(-1)!
        .payload.targets[1]!.target,
    );
    const capability = await mintCapabilityV1(
      () => observationV1(observedTarget),
    );
    const result =
      await selectProviderTrustedLocalPhysicalTargetCandidateV1({
        distributionHistoryCandidate,
        physicalTargetObservationCapability: capability,
      });
    expect(
      result.distributionHistoryCandidate.currentCatalogProjection.targetCount,
    ).toBe(2);
    expect(result.selectedOwnerTargetCapability.target).toEqual(
      observedTarget,
    );
  });

  it("selects the complete trusted opened-root target across Universe, Catalog and owner projection with none authority", async () => {
    const capability = await mintCapabilityV1();
    expect(Object.getPrototypeOf(capability)).toBeNull();
    expect(Object.isFrozen(capability)).toBe(true);
    expect(Reflect.ownKeys(capability)).toEqual([]);

    const result = await selectProviderTrustedLocalPhysicalTargetCandidateV1({
      distributionHistoryCandidate: distributionInputV1(),
      physicalTargetObservationCapability: capability,
    });
    expect(Object.keys(result).sort()).toEqual([
      "authority",
      "distributionHistoryCandidate",
      "providerFeasibilitySupportCatalogPin",
      "selectedOwnerTargetCapability",
    ]);
    expect(result.authority).toBe(
      PROVIDER_TRUSTED_LOCAL_PHYSICAL_TARGET_SELECTION_CANDIDATE_AUTHORITY_V1,
    );
    expect(result.selectedOwnerTargetCapability).toEqual({
      target: targetV1(),
      capability: "strong_read_write",
    });
    expect(result.providerFeasibilitySupportCatalogPin).toEqual(
      result.distributionHistoryCandidate.currentCatalogProjection
        .providerFeasibilitySupportCatalogPin,
    );
    expectRecursivelyFrozenV1(result);
  });

  it("burns a submitted handle before malformed top-level/source handling and reports bounded stages", async () => {
    const capability = await mintCapabilityV1();
    await expect(
      diagnoseProviderTrustedLocalPhysicalTargetCandidateV1({
        distributionHistoryCandidate: distributionInputV1(),
        physicalTargetObservationCapability: capability,
        extra: true,
      }),
    ).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    await expect(
      diagnoseProviderTrustedLocalPhysicalTargetCandidateV1({
        distributionHistoryCandidate: distributionInputV1(),
        physicalTargetObservationCapability: capability,
      }),
    ).resolves.toEqual({
      ok: false,
      stage: "physical_target_observation_capability",
      reason: "capability_invalid",
    });

    const sourceCapability = await mintCapabilityV1();
    await expect(
      diagnoseProviderTrustedLocalPhysicalTargetCandidateV1({
        distributionHistoryCandidate: {},
        physicalTargetObservationCapability: sourceCapability,
      }),
    ).resolves.toEqual({
      ok: false,
      stage: "distribution_history_candidate",
      reason: "source_invalid",
    });
  });

  it.each([
    ["plain object", Object.freeze(Object.create(null))],
    ["JSON copy", JSON.parse("{}")],
    ["structured clone", structuredClone(Object.freeze(Object.create(null)))],
  ])("rejects a %s as an unforgeable observation capability", async (_label, handle) => {
    await expect(
      diagnoseProviderTrustedLocalPhysicalTargetCandidateV1({
        distributionHistoryCandidate: distributionInputV1(),
        physicalTargetObservationCapability: handle,
      }),
    ).resolves.toEqual({
      ok: false,
      stage: "physical_target_observation_capability",
      reason: "capability_invalid",
    });
  });

  it("allows at most one concurrent consume and invokes C09-1N only for the claimant", async () => {
    const capability = await mintCapabilityV1();
    const input = {
      distributionHistoryCandidate: distributionInputV1(),
      physicalTargetObservationCapability: capability,
    };
    const results = await Promise.all([
      diagnoseProviderTrustedLocalPhysicalTargetCandidateV1(input),
      diagnoseProviderTrustedLocalPhysicalTargetCandidateV1(input),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      {
        ok: false,
        stage: "physical_target_observation_capability",
        reason: "capability_invalid",
      },
    ]);
  });

  it("rejects a trusted complete target with no exact three-layer match", async () => {
    const differentTarget = targetWithBuildDigestV1(
      `sha256:${"f".repeat(64)}`,
    );
    const capability = await mintCapabilityV1(
      () => observationV1(differentTarget),
    );
    await expect(
      diagnoseProviderTrustedLocalPhysicalTargetCandidateV1({
        distributionHistoryCandidate: distributionInputV1(),
        physicalTargetObservationCapability: capability,
      }),
    ).resolves.toEqual({
      ok: false,
      stage: "local_target_selection",
      reason: "target_zero_match",
    });
  });

  it.each([
    [
      "root-volume witness",
      () => [
        observationV1(),
        observationV1(),
        observationV1(targetV1(), 0x40),
      ],
      "root_volume_changed",
    ],
    [
      "physical target",
      () => {
        const changed = targetWithBuildDigestV1(
          `sha256:${"e".repeat(64)}`,
        );
        return [observationV1(), observationV1(), observationV1(changed)];
      },
      "observation_changed",
    ],
    [
      "root-volume witness and physical target",
      () => {
        const changed = targetWithBuildDigestV1(
          `sha256:${"d".repeat(64)}`,
        );
        return [
          observationV1(),
          observationV1(),
          observationV1(changed, 0x40),
        ];
      },
      "root_volume_changed",
    ],
  ] as const)("fails the postcheck when the %s changes", async (_label, createObservations, reason) => {
    const observations = createObservations();
    const observe = vi.fn(() => observations.shift());
    const capability = await mintCapabilityV1(observe);
    await expect(
      diagnoseProviderTrustedLocalPhysicalTargetCandidateV1({
        distributionHistoryCandidate: distributionInputV1(),
        physicalTargetObservationCapability: capability,
      }),
    ).resolves.toEqual({
      ok: false,
      stage: "physical_target_postcheck",
      reason,
    });
  });

  it("returns only the opaque public failure", async () => {
    const promise = selectProviderTrustedLocalPhysicalTargetCandidateV1({
      distributionHistoryCandidate: distributionInputV1(),
      physicalTargetObservationCapability: Object.freeze(
        Object.create(null),
      ) as ProviderTrustedLocalPhysicalTargetObservationCapabilityV1,
    });
    await expect(promise).rejects.toBeInstanceOf(
      ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationError,
    );
    await expect(promise).rejects.toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    await expect(promise).rejects.not.toHaveProperty("stage");
  });
});
