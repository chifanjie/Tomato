import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_RELEASE_TARGET_UNIVERSE_DOMAIN_V1,
  PROVIDER_RELEASE_TARGET_UNIVERSE_LOCATOR_PROFILE_V1,
  PROVIDER_RELEASE_TARGET_UNIVERSE_SIGNATURE_DOMAIN_V1,
  ProviderReleaseCoverageIncompleteReasonV1Schema,
  ProviderReleaseTargetBucketCoverageV1Schema,
  ProviderReleaseTargetCoverageBasisV1Schema,
  ProviderReleaseTargetCoverageResolutionV1Schema,
  ProviderReleaseTargetUniverseBucketV1Schema,
  ProviderReleaseTargetUniverseEnvelopeV1Schema,
  ProviderReleaseTargetUniversePinV1Schema,
  ProviderReleaseTargetUniverseSignatureWrapperV1Schema,
  ProviderReleaseTargetUniverseUnsignedClaimsV1Schema,
  ProviderReleaseTargetUniverseV1Schema,
  createProviderReleaseTargetUniverseSignatureMessageV1,
  deriveProviderReleaseTargetUniverseContentDigestV1,
  projectProviderReleaseTargetUniverseUnsignedClaimsV1,
} from "../src/provider-release-target-universe-point.js";
import { ProviderReleaseTargetUniverseSignatureV1Schema } from "../src/primitives.js";
import {
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1,
  ProviderTargetDiscoveryPointGoldenManifestV1Schema,
} from "../src/provider-target-discovery-point-fixtures.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const golden = ProviderTargetDiscoveryPointGoldenManifestV1Schema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          `../${PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1}`,
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  ),
);

const ROOT_KEY_ID = golden.activeRoot.rootKeyId;
const UNIVERSE_SIGNATURE =
  `provider-release-target-universe-ed25519:${ROOT_KEY_ID}:${"00".repeat(64)}`;

function sampleUniverse(): unknown {
  const matrixEnvelope = golden.releaseMatrix;
  const matrix = matrixEnvelope.payload;
  const resultEnvelope = golden.targetDiscoveryResult;
  const result = resultEnvelope.payload;
  const reason = "taxonomy_mapping_unresolved" as const;
  const buckets = result.targets.map((entry) => ({
    publicProfileId: entry.publicProfileId,
    osPlatform: entry.target.osPlatform,
    osReleaseFamilyCode: entry.target.osReleaseFamilyCode,
    architecture: entry.target.architecture,
    filesystemProfileCode: entry.target.filesystemProfileCode,
    coverage: {
      coverageState: "incomplete" as const,
      reason,
      targetProfileIds: [entry.target.targetProfileId],
    },
  }));
  return clone({
    profile: "provider_release_target_universe_v1",
    distributionRootBinding: golden.distributionRootBinding,
    activeRootMetadata: golden.activeRootMetadata,
    registryRootKeyId: ROOT_KEY_ID,
    universeGeneration: 1,
    publicSupportTaxonomy: result.publicSupportTaxonomy,
    coverageBasis: {
      profile: "provider_release_target_coverage_basis_v1",
      releaseMatrix: {
        locatorProfile: "distribution_provider_release_matrix_v1",
        releaseMatrixGeneration: matrix.releaseMatrixGeneration,
        contentDigest: matrixEnvelope.contentDigest,
      },
      targetDiscoveryResult: {
        locatorProfile: "distribution_provider_target_discovery_result_v1",
        discoveryGeneration: result.discoveryGeneration,
        contentDigest: resultEnvelope.contentDigest,
      },
      targetDiscoveryInputBundleContentDigest:
        result.targetDiscoveryInputBundleContentDigest,
      observationCutDigest: result.observationCutDigest,
      observationSetDigest: result.observationSetDigest,
      limits: result.limits,
      discoveryRulesetVersion: result.discoveryRulesetVersion,
      requiredDimensions: result.requiredDimensions,
      observationSources: result.observationSources,
      releaseMatrixTargetCount: matrix.targetCount,
      releaseMatrixTargetSetDigest: matrix.targetSetDigest,
      discoveredTargetCount: result.targetCount,
      discoveredTargetSetDigest: result.targetSetDigest,
      unresolvedObservationCount: result.unresolvedObservationCount,
      resolution: {
        state: "incomplete",
        reason,
      },
    },
    targets: result.targets,
    buckets,
    universeSignature: UNIVERSE_SIGNATURE,
  });
}

function messageSha256Hex(message: Uint8Array): string {
  return createHash("sha256").update(message).digest("hex");
}

describe("release target Universe normative wire", () => {
  it("accepts only the exact lowercase Universe signature wire", () => {
    expect(
      ProviderReleaseTargetUniverseSignatureV1Schema.parse(UNIVERSE_SIGNATURE),
    ).toBe(UNIVERSE_SIGNATURE);
    expect(
      ProviderReleaseTargetUniverseSignatureV1Schema.safeParse(
        UNIVERSE_SIGNATURE.toUpperCase(),
      ).success,
    ).toBe(false);
    expect(
      ProviderReleaseTargetUniverseSignatureV1Schema.safeParse(
        `provider-release-target-universe-ed25519:${"a".repeat(21)}:${"0".repeat(128)}`,
      ).success,
    ).toBe(false);
    expect(
      ProviderReleaseTargetUniverseSignatureV1Schema.safeParse(
        `provider-release-target-universe-ed25519:${"a".repeat(22)}:${"0".repeat(127)}`,
      ).success,
    ).toBe(false);
    expect(
      ProviderReleaseTargetUniverseSignatureV1Schema.safeParse(
        `${UNIVERSE_SIGNATURE}:trailing`,
      ).success,
    ).toBe(false);
  });

  it("freezes the named strict coverage unions and their reason vocabulary", () => {
    expect(ProviderReleaseCoverageIncompleteReasonV1Schema.options).toEqual([
      "release_matrix_incomplete",
      "target_discovery_unresolved",
      "taxonomy_mapping_unresolved",
    ]);
    const targetProfileId = golden.targetDiscoveryResult.payload.targets[0]!.target
      .targetProfileId;
    expect(
      ProviderReleaseTargetBucketCoverageV1Schema.safeParse({
        coverageState: "closed_world_complete",
        targetProfileIds: [targetProfileId],
      }).success,
    ).toBe(true);
    expect(
      ProviderReleaseTargetBucketCoverageV1Schema.safeParse({
        coverageState: "closed_world_complete",
        reason: "release_matrix_incomplete",
        targetProfileIds: [targetProfileId],
      }).success,
    ).toBe(false);
    expect(
      ProviderReleaseTargetBucketCoverageV1Schema.safeParse({
        coverageState: "incomplete",
        targetProfileIds: [targetProfileId],
      }).success,
    ).toBe(false);
    expect(
      ProviderReleaseTargetCoverageResolutionV1Schema.safeParse({
        state: "closed_world_complete",
      }).success,
    ).toBe(true);
    expect(
      ProviderReleaseTargetCoverageResolutionV1Schema.safeParse({
        state: "closed_world_complete",
        reason: "target_discovery_unresolved",
      }).success,
    ).toBe(false);
    expect(
      ProviderReleaseTargetCoverageResolutionV1Schema.safeParse({
        state: "incomplete",
      }).success,
    ).toBe(false);
  });

  it("keeps generation/predecessor history semantics out of the strict wire Schema", () => {
    const universe = ProviderReleaseTargetUniverseV1Schema.parse(sampleUniverse());
    expect(universe.universeGeneration).toBe(1);
    expect(universe).not.toHaveProperty("predecessorUniverseContentDigest");

    const generationTwoWithoutPredecessor = clone(universe);
    generationTwoWithoutPredecessor.universeGeneration = 2;
    expect(
      ProviderReleaseTargetUniverseV1Schema.safeParse(
        generationTwoWithoutPredecessor,
      ).success,
    ).toBe(true);

    const genesisWithPredecessor = clone(universe);
    Object.assign(genesisWithPredecessor, {
      predecessorUniverseContentDigest: `sha256:${"a".repeat(64)}`,
    });
    expect(
      ProviderReleaseTargetUniverseV1Schema.safeParse(genesisWithPredecessor)
        .success,
    ).toBe(true);

    for (const invalidGeneration of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const invalid = clone(universe);
      invalid.universeGeneration = invalidGeneration;
      expect(ProviderReleaseTargetUniverseV1Schema.safeParse(invalid).success).toBe(
        false,
      );
    }
  });

  it("keeps every Universe object strict and every required set nonempty", () => {
    const universe = ProviderReleaseTargetUniverseV1Schema.parse(sampleUniverse());
    expect(
      ProviderReleaseTargetCoverageBasisV1Schema.parse(universe.coverageBasis),
    ).toEqual(universe.coverageBasis);
    expect(
      ProviderReleaseTargetUniverseBucketV1Schema.parse(universe.buckets[0]),
    ).toEqual(universe.buckets[0]);

    const extraBucketKey = clone(universe.buckets[0]!);
    Object.assign(extraBucketKey, { privatePath: "/not-on-wire" });
    expect(
      ProviderReleaseTargetUniverseBucketV1Schema.safeParse(extraBucketKey).success,
    ).toBe(false);

    const noTargets = clone(universe);
    noTargets.targets = [];
    expect(ProviderReleaseTargetUniverseV1Schema.safeParse(noTargets).success).toBe(
      false,
    );
    const noBuckets = clone(universe);
    noBuckets.buckets = [];
    expect(ProviderReleaseTargetUniverseV1Schema.safeParse(noBuckets).success).toBe(
      false,
    );
    const extraUniverseKey = clone(universe);
    Object.assign(extraUniverseKey, { current: true });
    expect(
      ProviderReleaseTargetUniverseV1Schema.safeParse(extraUniverseKey).success,
    ).toBe(false);
  });

  it("enforces the exact 4096/4097 wire array caps", () => {
    const universe = ProviderReleaseTargetUniverseV1Schema.parse(sampleUniverse());
    const unsigned = projectProviderReleaseTargetUniverseUnsignedClaimsV1(universe);
    const target = unsigned.targets[0]!;
    const bucket = unsigned.buckets[0]!;
    const targetProfileId = target.target.targetProfileId;

    expect(
      ProviderReleaseTargetBucketCoverageV1Schema.safeParse({
        coverageState: "closed_world_complete",
        targetProfileIds: Array.from({ length: 4096 }, () => targetProfileId),
      }).success,
    ).toBe(true);
    expect(
      ProviderReleaseTargetBucketCoverageV1Schema.safeParse({
        coverageState: "closed_world_complete",
        targetProfileIds: Array.from({ length: 4097 }, () => targetProfileId),
      }).success,
    ).toBe(false);

    const targetsAtCap = {
      ...unsigned,
      targets: Array.from({ length: 4096 }, () => target),
    };
    expect(
      ProviderReleaseTargetUniverseUnsignedClaimsV1Schema.safeParse(targetsAtCap)
        .success,
    ).toBe(true);
    expect(
      ProviderReleaseTargetUniverseUnsignedClaimsV1Schema.safeParse({
        ...targetsAtCap,
        targets: [...targetsAtCap.targets, target],
      }).success,
    ).toBe(false);

    const bucketsAtCap = {
      ...unsigned,
      buckets: Array.from({ length: 4096 }, () => bucket),
    };
    expect(
      ProviderReleaseTargetUniverseUnsignedClaimsV1Schema.safeParse(bucketsAtCap)
        .success,
    ).toBe(true);
    expect(
      ProviderReleaseTargetUniverseUnsignedClaimsV1Schema.safeParse({
        ...bucketsAtCap,
        buckets: [...bucketsAtCap.buckets, bucket],
      }).success,
    ).toBe(false);
  });

  it("projects signed and unsigned claims identically and excludes the signature from the digest", () => {
    const signed = ProviderReleaseTargetUniverseV1Schema.parse(sampleUniverse());
    const unsigned = projectProviderReleaseTargetUniverseUnsignedClaimsV1(signed);
    expect(unsigned).not.toHaveProperty("universeSignature");
    expect(projectProviderReleaseTargetUniverseUnsignedClaimsV1(unsigned)).toEqual(
      unsigned,
    );

    const changedSignature = clone(signed);
    Object.assign(changedSignature, {
      universeSignature:
        `provider-release-target-universe-ed25519:${ROOT_KEY_ID}:${"ff".repeat(64)}`,
    });
    const contentDigest = deriveProviderReleaseTargetUniverseContentDigestV1(signed);
    expect(contentDigest).toBe(
      "sha256:8dd59137c57eadda4e13ca0107bb51f24c60fed0e41b141390813053d1f6677d",
    );
    expect(deriveProviderReleaseTargetUniverseContentDigestV1(changedSignature)).toBe(
      contentDigest,
    );

    const changedClaims = clone(signed);
    changedClaims.universeGeneration = 2;
    expect(deriveProviderReleaseTargetUniverseContentDigestV1(changedClaims)).not.toBe(
      deriveProviderReleaseTargetUniverseContentDigestV1(signed),
    );
    expect(PROVIDER_RELEASE_TARGET_UNIVERSE_DOMAIN_V1).toBe(
      "provider-release-target-universe-v1",
    );
  });

  it("canonicalizes the exact root/domain/claims signature wrapper", () => {
    const signed = ProviderReleaseTargetUniverseV1Schema.parse(sampleUniverse());
    const unsigned = projectProviderReleaseTargetUniverseUnsignedClaimsV1(signed);
    const signedMessage = createProviderReleaseTargetUniverseSignatureMessageV1(
      signed,
    );
    const unsignedMessage = createProviderReleaseTargetUniverseSignatureMessageV1(
      unsigned,
      ROOT_KEY_ID,
    );
    expect(unsignedMessage).toEqual(signedMessage);

    const parsedMessage = JSON.parse(new TextDecoder().decode(signedMessage));
    expect(parsedMessage).toEqual([
      PROVIDER_RELEASE_TARGET_UNIVERSE_SIGNATURE_DOMAIN_V1,
      {
        rootKeyId: ROOT_KEY_ID,
        domain: PROVIDER_RELEASE_TARGET_UNIVERSE_SIGNATURE_DOMAIN_V1,
        claims: unsigned,
      },
    ]);
    expect(
      ProviderReleaseTargetUniverseSignatureWrapperV1Schema.parse(
        parsedMessage[1],
      ),
    ).toEqual(parsedMessage[1]);
    expect(messageSha256Hex(signedMessage)).toBe(
      "ef04998198c168a99614bb8c0d767ff00ca2df241b0084fa7843a7ce7d9a57ec",
    );

    expect(() =>
      createProviderReleaseTargetUniverseSignatureMessageV1(
        signed,
        "aaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).toThrow("signature root key mismatch");
    expect(() =>
      createProviderReleaseTargetUniverseSignatureMessageV1(unsigned),
    ).toThrow("rootKeyId is required for unsigned claims");
  });

  it("binds the strict Envelope and Pin wire without accepting locator aliases", () => {
    const payload = ProviderReleaseTargetUniverseV1Schema.parse(sampleUniverse());
    const contentDigest = deriveProviderReleaseTargetUniverseContentDigestV1(payload);
    const envelope = ProviderReleaseTargetUniverseEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_release_target_universe",
      universeGeneration: payload.universeGeneration,
      contentDigest,
      payload,
    });
    expect(envelope.contentDigest).toBe(contentDigest);

    const pin = ProviderReleaseTargetUniversePinV1Schema.parse({
      locatorProfile: PROVIDER_RELEASE_TARGET_UNIVERSE_LOCATOR_PROFILE_V1,
      universeGeneration: envelope.universeGeneration,
      contentDigest: envelope.contentDigest,
    });
    expect(pin.locatorProfile).toBe(
      "distribution_provider_release_target_universe_v1",
    );
    expect(
      ProviderReleaseTargetUniversePinV1Schema.safeParse({
        ...pin,
        locatorProfile: "distribution_provider_release_matrix_v1",
      }).success,
    ).toBe(false);
    expect(
      ProviderReleaseTargetUniversePinV1Schema.safeParse({
        ...pin,
        universeGeneration: 0,
      }).success,
    ).toBe(false);
    expect(
      ProviderReleaseTargetUniversePinV1Schema.safeParse({
        ...pin,
        path: "provider/release-target-universe/latest.json",
      }).success,
    ).toBe(false);
  });
});
