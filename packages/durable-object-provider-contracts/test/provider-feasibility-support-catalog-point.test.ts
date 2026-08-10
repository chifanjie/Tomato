import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

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
  DurableObjectIdentityProviderIdV1Schema,
} from "../src/primitives.js";
import {
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
  ProviderFeasibilitySupportCatalogPointClosureValidationError,
  diagnoseProviderFeasibilitySupportCatalogPointClosureV1,
  validateProviderFeasibilitySupportCatalogPointClosureV1,
  type ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
} from "../src/provider-feasibility-support-catalog-point.js";
import {
  buildGoldenProviderFeasibilitySupportCatalogPointFixture,
  buildProviderFeasibilitySupportCandidateFixture,
  jsonClone,
  requestFromGoldenProviderFeasibilitySupportCatalogPositiveVectorFixture,
  requestFromGoldenProviderFeasibilitySupportCatalogPointFixture,
  resignProviderFeasibilitySupportCatalogEnvelopeFixture,
} from "../scripts/lib/provider-feasibility-support-catalog-point-fixture.mjs";

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

function resourceJson(relativePath: string): unknown {
  return JSON.parse(new TextDecoder().decode(resourceBytes(relativePath)));
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

const golden = buildGoldenProviderFeasibilitySupportCatalogPointFixture({
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
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);

let strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;

beforeAll(async () => {
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
});

function request(): ValidateProviderFeasibilitySupportCatalogPointClosureV1Input {
  return requestFromGoldenProviderFeasibilitySupportCatalogPointFixture(
    golden,
    strictCryptoCapability,
  ) as ValidateProviderFeasibilitySupportCatalogPointClosureV1Input;
}

function resignCatalog(
  input: ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
): void {
  Object.assign(input, {
    providerFeasibilitySupportCatalog:
      resignProviderFeasibilitySupportCatalogEnvelopeFixture(
        input.providerFeasibilitySupportCatalog,
        { rootKeyId: golden.discovery.activeRoot.rootKeyId },
      ),
  });
}

function requestWithDuplicateProviderCandidate():
  ValidateProviderFeasibilitySupportCatalogPointClosureV1Input {
  const input = request();
  const candidates =
    input.providerFeasibilitySupportCatalog.payload.targets[0]!.candidates;
  candidates.push(jsonClone(candidates[0]!));
  resignCatalog(input);
  return input;
}

function requestWithCrossGroupEvidence():
  ValidateProviderFeasibilitySupportCatalogPointClosureV1Input {
  const input = request();
  const targets = input.providerFeasibilitySupportCatalog.payload.targets;
  const firstCandidates = targets[0]!.candidates;
  targets[0]!.candidates = targets[1]!.candidates;
  targets[1]!.candidates = firstCandidates;
  resignCatalog(input);
  return input;
}

function expectRecursivelyFrozen(
  value: unknown,
  seen = new Set<object>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectRecursivelyFrozen(descriptor.value, seen);
    }
  }
}

async function expectRejectedAt(
  input: ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
  stage: string,
  reason: string,
): Promise<void> {
  await expect(
    validateProviderFeasibilitySupportCatalogPointClosureV1(input),
  ).rejects.toBeInstanceOf(
    ProviderFeasibilitySupportCatalogPointClosureValidationError,
  );
  await expect(
    diagnoseProviderFeasibilitySupportCatalogPointClosureV1(input),
  ).resolves.toEqual({ ok: false, stage, reason });
}

describe("provider feasibility support Catalog point", () => {
  it("accepts one closed-world one-public-bucket/two-target/two-candidate Catalog without authority", async () => {
    const input = request();
    expect(Object.keys(input).sort()).toEqual([
      "activeRoot",
      "activeRootMetadata",
      "bootstrapTrustBundle",
      "distributionRootBinding",
      "fixtureCorpusManifest",
      "installationIdentityGenerationId",
      "providerFeasibilitySupportCandidateArtifacts",
      "providerFeasibilitySupportCatalog",
      "publicSupportTaxonomy",
      "registryManifestHistory",
      "releaseMatrix",
      "releaseTargetUniverse",
      "rootMetadataHistory",
      "strictCryptoCapability",
      "suiteManifest",
      "targetDiscoveryFixtureManifest",
      "targetDiscoveryResult",
      "targetDiscoveryRunnerRun",
    ]);

    const closure =
      await validateProviderFeasibilitySupportCatalogPointClosureV1(input);

    expect(closure.authority).toBe(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
    );
    expect(closure.authority).toBe(golden.expected.authority);
    expect(closure.ownerTargetCapabilities).toEqual(
      golden.expected.ownerTargetCapabilities,
    );
    expect(closure.publicSupport).toEqual(golden.expected.publicSupport);
    expect(closure.ownerTargetCapabilities).toHaveLength(2);
    expect(closure.publicSupport).toHaveLength(1);
    expect(
      closure.ownerTargetCapabilities.every(
        (entry) => entry.capability === "strong_read_write",
      ),
    ).toBe(true);
    expect(
      closure.publicSupport.every(
        (entry) => entry.capability === "strong_read_write",
      ),
    ).toBe(true);
    expectRecursivelyFrozen(closure);
  });

  it.each([
    "second-passed-read-only",
    "second-failed-read-only",
    "second-unsupported-read-only",
  ] as const)(
    "projects the one public bucket as read-only for %s",
    async (vectorId) => {
      const vector = golden.positiveVectors.find(
        (candidate) => candidate.vectorId === vectorId,
      );
      expect(vector).toBeDefined();
      const closure =
        await validateProviderFeasibilitySupportCatalogPointClosureV1(
          requestFromGoldenProviderFeasibilitySupportCatalogPositiveVectorFixture(
            golden,
            vectorId,
            strictCryptoCapability,
          ),
        );

      expect(closure.authority).toBe(
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
      );
      expect(closure.ownerTargetCapabilities).toEqual(
        vector!.expected.ownerTargetCapabilities,
      );
      expect(closure.publicSupport).toEqual(vector!.expected.publicSupport);
      expect(closure.ownerTargetCapabilities.map((entry) => entry.capability))
        .toEqual(["strong_read_write", "legacy_redacted_read_only"]);
      expect(closure.publicSupport).toEqual([
        expect.objectContaining({
          capability: "legacy_redacted_read_only",
        }),
      ]);
      expectRecursivelyFrozen(closure);
    },
  );

  it("rejects a signed Catalog that omits a Universe target", async () => {
    const input = request();
    input.providerFeasibilitySupportCatalog.payload.targets.splice(1, 1);
    resignCatalog(input);
    await expectRejectedAt(
      input,
      "catalog_target_exact_cover",
      "coverage_mismatch",
    );
  });

  it("rejects a signed Catalog that adds a target outside the Universe", async () => {
    const input = request();
    const first = jsonClone(
      input.providerFeasibilitySupportCatalog.payload.targets[0]!,
    );
    const fields = {
      osPlatform: first.target.osPlatform,
      osReleaseFamilyCode: first.target.osReleaseFamilyCode,
      osBuildDigest:
        `sha256:${"a".repeat(64)}` as typeof first.target.osBuildDigest,
      architecture: first.target.architecture,
      filesystemProfileCode: first.target.filesystemProfileCode,
      filesystemFeatureProfileDigest:
        `sha256:${"b".repeat(64)}` as
          typeof first.target.filesystemFeatureProfileDigest,
      mountOptionProfileDigest:
        `sha256:${"c".repeat(64)}` as typeof first.target.mountOptionProfileDigest,
    };
    first.target = {
      targetProfileId: deriveProviderTargetProfileIdV1(fields),
      ...fields,
    };
    input.providerFeasibilitySupportCatalog.payload.targets.push(first);
    input.providerFeasibilitySupportCatalog.payload.targets.sort((left, right) =>
      compareUtf8(left.target.targetProfileId, right.target.targetProfileId),
    );
    resignCatalog(input);
    await expectRejectedAt(
      input,
      "catalog_target_exact_cover",
      "coverage_mismatch",
    );
  });

  it("rejects a signed Catalog with a duplicate target group", async () => {
    const input = request();
    input.providerFeasibilitySupportCatalog.payload.targets.splice(
      1,
      0,
      jsonClone(input.providerFeasibilitySupportCatalog.payload.targets[0]!),
    );
    resignCatalog(input);
    await expectRejectedAt(
      input,
      "catalog_target_order",
      "ordering_invalid",
    );
  });

  it("rejects a signed Catalog with a duplicate provider candidate", async () => {
    await expect(
      validateProviderFeasibilitySupportCatalogPointClosureV1(
        requestWithDuplicateProviderCandidate(),
      ),
    ).rejects.toBeInstanceOf(
      ProviderFeasibilitySupportCatalogPointClosureValidationError,
    );
  });

  it("diagnoses a duplicate provider candidate at Catalog candidate ordering", async () => {
    await expect(
      diagnoseProviderFeasibilitySupportCatalogPointClosureV1(
        requestWithDuplicateProviderCandidate(),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "catalog_candidate_order",
      reason: "ordering_invalid",
    });
  });

  it("rejects signed cross-group Evidence even when each candidate is valid", async () => {
    await expect(
      validateProviderFeasibilitySupportCatalogPointClosureV1(
        requestWithCrossGroupEvidence(),
      ),
    ).rejects.toBeInstanceOf(
      ProviderFeasibilitySupportCatalogPointClosureValidationError,
    );
  });

  it("diagnoses signed cross-group Evidence at the candidate binding boundary", async () => {
    await expect(
      diagnoseProviderFeasibilitySupportCatalogPointClosureV1(
        requestWithCrossGroupEvidence(),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "catalog_candidate_binding",
      reason: "binding_mismatch",
    });
  });

  it("rejects a fully resigned candidate for an unregistered provider", async () => {
    const input = request();
    const group = input.providerFeasibilitySupportCatalog.payload.targets[0]!;
    const originalCandidate = group.candidates[0]!;
    const unregisteredProviderId =
      DurableObjectIdentityProviderIdV1Schema.parse(
        "durable-object-provider:unregistered",
      );
    const registryTip = input.registryManifestHistory.at(-1)!;
    expect(
      registryTip.payload.members.some(
        (member) => member.providerId === unregisteredProviderId,
      ),
    ).toBe(false);

    const replacement = buildProviderFeasibilitySupportCandidateFixture({
      discovery: golden.discovery,
      targetProfileId: group.target.targetProfileId,
      qaApproverPublicKey: golden.compatible.qaApproverPublicKey,
      releaseApproverPublicKey: golden.compatible.releaseApproverPublicKey,
      providerId: unregisteredProviderId,
      result: "passed",
      releaseDisposition: "strong_read_write",
    });
    const {
      providerId: originalPolicyProviderId,
      ...originalPolicyWithoutProvider
    } = originalCandidate.semanticProviderPolicy;
    const {
      providerId: replacementPolicyProviderId,
      ...replacementPolicyWithoutProvider
    } = replacement.catalogCandidate.semanticProviderPolicy;
    expect(originalPolicyProviderId).not.toBe(unregisteredProviderId);
    expect(replacementPolicyProviderId).toBe(unregisteredProviderId);
    expect(replacementPolicyWithoutProvider).toEqual(
      originalPolicyWithoutProvider,
    );
    expect(
      replacement.candidateArtifact.providerFeasibilityEvidence.payload
        .qaSignature,
    ).toContain(`:${golden.compatible.qaApproverPublicKey.keyId}:`);
    expect(
      replacement.candidateArtifact.providerFeasibilityEvidence.payload
        .releaseSignature,
    ).toContain(`:${golden.compatible.releaseApproverPublicKey.keyId}:`);
    group.candidates = [jsonClone(replacement.catalogCandidate)];
    const candidateArtifacts =
      input.providerFeasibilitySupportCandidateArtifacts.slice();
    candidateArtifacts[0] = jsonClone(replacement.candidateArtifact);
    Object.assign(input, {
      providerFeasibilitySupportCandidateArtifacts: candidateArtifacts,
    });
    resignCatalog(input);

    await expectRejectedAt(
      input,
      "catalog_candidate_binding",
      "binding_mismatch",
    );
  });

  it("rejects a candidate artifact count mismatch at the binding boundary", async () => {
    const input = request();
    Object.assign(input, {
      providerFeasibilitySupportCandidateArtifacts:
        input.providerFeasibilitySupportCandidateArtifacts.slice(0, 1),
    });

    await expectRejectedAt(
      input,
      "catalog_candidate_binding",
      "count_mismatch",
    );
  });

  it("checks every target identity before an earlier candidate-order fault", async () => {
    const input = request();
    const targets = input.providerFeasibilitySupportCatalog.payload.targets;
    const firstCandidates = targets[0]!.candidates;
    firstCandidates.push(jsonClone(firstCandidates[0]!));
    const laterTarget = targets[1]!.target;
    expect(laterTarget.osBuildDigest).not.toBe(`sha256:${"9".repeat(64)}`);
    Object.assign(laterTarget, {
      osBuildDigest: `sha256:${"9".repeat(64)}`,
    });
    resignCatalog(input);

    await expectRejectedAt(
      input,
      "catalog_target_identity",
      "identity_mismatch",
    );
  });

  it("checks every candidate binding before an earlier release-disposition fault", async () => {
    const input = request();
    const targets = input.providerFeasibilitySupportCatalog.payload.targets;
    const firstTarget = targets[0]!.target;
    const replacement = buildProviderFeasibilitySupportCandidateFixture({
      discovery: golden.discovery,
      targetProfileId: firstTarget.targetProfileId,
      qaApproverPublicKey: golden.compatible.qaApproverPublicKey,
      releaseApproverPublicKey: golden.compatible.releaseApproverPublicKey,
      result: "failed",
      releaseDisposition: "strong_read_write",
    });
    targets[0]!.candidates = [jsonClone(replacement.catalogCandidate)];
    const candidateArtifacts =
      input.providerFeasibilitySupportCandidateArtifacts.slice();
    candidateArtifacts[0] = jsonClone(replacement.candidateArtifact);
    Object.assign(input, {
      providerFeasibilitySupportCandidateArtifacts: candidateArtifacts,
    });

    const laterCandidate = targets[1]!.candidates[0]!;
    expect(laterCandidate.providerFeasibilityEvidence.contentDigest).not.toBe(
      `sha256:${"0".repeat(64)}`,
    );
    Object.assign(laterCandidate.providerFeasibilityEvidence, {
      contentDigest: `sha256:${"0".repeat(64)}`,
    });
    resignCatalog(input);

    await expectRejectedAt(
      input,
      "catalog_candidate_binding",
      "binding_mismatch",
    );
  });

  it("keeps exact diagnostics under a post-load Symbol.hasInstance poison", async () => {
    const input = request();
    Object.assign(input, {
      providerFeasibilitySupportCandidateArtifacts:
        input.providerFeasibilitySupportCandidateArtifacts.slice(0, 1),
    });
    const intrinsicHasInstanceDescriptor = Object.getOwnPropertyDescriptor(
      Function.prototype,
      Symbol.hasInstance,
    );
    expect(intrinsicHasInstanceDescriptor).toMatchObject({
      configurable: false,
      writable: false,
    });
    const originalErrorHasInstanceDescriptor = Object.getOwnPropertyDescriptor(
      Error,
      Symbol.hasInstance,
    );
    let poisonCalls = 0;
    let diagnostic:
      | Awaited<
          ReturnType<
            typeof diagnoseProviderFeasibilitySupportCatalogPointClosureV1
          >
        >
      | undefined;
    let escapedError: unknown;

    // Function.prototype[Symbol.hasInstance] is non-configurable. An own Error
    // shadow is the nearest executable poison for the internal Error subclass:
    // an `instanceof` check would resolve it before the intrinsic.
    Object.defineProperty(Error, Symbol.hasInstance, {
      configurable: true,
      value() {
        poisonCalls += 1;
        throw new TypeError("poisoned Function.prototype[Symbol.hasInstance]");
      },
    });
    try {
      diagnostic =
        await diagnoseProviderFeasibilitySupportCatalogPointClosureV1(input);
    } catch (error) {
      escapedError = error;
    } finally {
      if (originalErrorHasInstanceDescriptor === undefined) {
        if (!Reflect.deleteProperty(Error, Symbol.hasInstance)) {
          throw new TypeError("failed to restore Error[Symbol.hasInstance]");
        }
      } else {
        Object.defineProperty(
          Error,
          Symbol.hasInstance,
          originalErrorHasInstanceDescriptor,
        );
      }
    }

    expect(escapedError).toBeUndefined();
    expect(poisonCalls).toBe(0);
    expect(diagnostic).toEqual({
      ok: false,
      stage: "catalog_candidate_binding",
      reason: "count_mismatch",
    });
    expect(
      Object.getOwnPropertyDescriptor(Function.prototype, Symbol.hasInstance),
    ).toEqual(intrinsicHasInstanceDescriptor);
    expect(
      Object.getOwnPropertyDescriptor(Error, Symbol.hasInstance),
    ).toEqual(originalErrorHasInstanceDescriptor);
  });

  it.each(["failed", "unsupported"] as const)(
    "rejects a fully rebuilt %s Evidence candidate released as strong",
    async (result) => {
      const input = request();
      const target =
        input.providerFeasibilitySupportCatalog.payload.targets[0]!.target;
      const replacement = buildProviderFeasibilitySupportCandidateFixture({
        discovery: golden.discovery,
        targetProfileId: target.targetProfileId,
        qaApproverPublicKey: golden.compatible.qaApproverPublicKey,
        releaseApproverPublicKey:
          golden.compatible.releaseApproverPublicKey,
        result,
        releaseDisposition: "strong_read_write",
      });
      input.providerFeasibilitySupportCatalog.payload.targets[0]!.candidates = [
        jsonClone(replacement.catalogCandidate),
      ];
      const candidateArtifacts =
        input.providerFeasibilitySupportCandidateArtifacts.slice();
      candidateArtifacts[0] = jsonClone(
        replacement.candidateArtifact,
      );
      Object.assign(input, {
        providerFeasibilitySupportCandidateArtifacts: candidateArtifacts,
      });
      resignCatalog(input);
      await expectRejectedAt(
        input,
        "catalog_release_disposition",
        "result_not_passed",
      );
    },
  );
});
