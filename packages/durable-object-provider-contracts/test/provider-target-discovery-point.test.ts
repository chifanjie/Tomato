import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ProviderTargetDiscoveryPointClosureValidationError,
  buildProviderPublicSupportTaxonomyRelativePathV1,
  buildProviderReleaseMatrixRelativePathV1,
  buildProviderTargetDiscoveryFixtureManifestRelativePathV1,
  buildProviderTargetDiscoveryResultRelativePathV1,
  buildProviderTargetDiscoveryRunnerRunRelativePathV1,
  diagnoseProviderTargetDiscoveryPointClosureV1,
  validateProviderTargetDiscoveryPointClosureV1,
  type ValidateProviderTargetDiscoveryPointClosureV1Input,
} from "../src/provider-target-discovery-point.js";
import {
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1,
  ProviderTargetDiscoveryPointGoldenManifestV1Schema,
  type ProviderTargetDiscoveryPointGoldenManifestV1,
} from "../src/provider-target-discovery-point-fixtures.js";
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

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}
const golden = ProviderTargetDiscoveryPointGoldenManifestV1Schema.parse(
  JSON.parse(
    new TextDecoder().decode(
      resourceBytes(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1),
    ),
  ),
);
const strictManifestBytes = resourceBytes(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
let pointCalls = 0;
let verifyCalls = 0;
let blockNextVerification = false;
let verificationReached: (() => void) | undefined;
let releaseVerification: (() => void) | undefined;
let capability: ProviderStrictEd25519OpaqueCapabilityV1;

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(encodedPoint: Uint8Array) {
        pointCalls += 1;
        return validatePrimeSubgroupPoint(encodedPoint);
      },
      async verifyRawEd25519(
        publicKey: Uint8Array,
        message: Uint8Array,
        signature: Uint8Array,
      ) {
        verifyCalls += 1;
        if (blockNextVerification) {
          blockNextVerification = false;
          verificationReached?.();
          await new Promise<void>((resolve) => {
            releaseVerification = resolve;
          });
        }
        return verifyRawEd25519(publicKey, message, signature);
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        if (
          path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
          maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
        ) throw new TypeError("unexpected fixed resource request");
        return strictManifestBytes;
      },
    }),
  });
  pointCalls = 0;
  verifyCalls = 0;
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function request(
  manifest: ProviderTargetDiscoveryPointGoldenManifestV1 = golden,
): ValidateProviderTargetDiscoveryPointClosureV1Input {
  return {
    distributionRootBinding: clone(manifest.distributionRootBinding),
    activeRootMetadata: clone(manifest.activeRootMetadata),
    activeRoot: clone(manifest.activeRoot),
    fixtureCorpusManifest: clone(manifest.fixtureCorpusManifest),
    suiteManifest: clone(manifest.suiteManifest),
    publicSupportTaxonomy: clone(manifest.publicSupportTaxonomy),
    releaseMatrix: clone(manifest.releaseMatrix),
    targetDiscoveryFixtureManifest: clone(manifest.targetDiscoveryFixtureManifest),
    targetDiscoveryRunnerRun: clone(manifest.targetDiscoveryRunnerRun),
    targetDiscoveryResult: clone(manifest.targetDiscoveryResult),
    strictCryptoCapability: capability,
  };
}

async function expectInputDiagnostic(input: unknown): Promise<void> {
  const diagnostic = await diagnoseProviderTargetDiscoveryPointClosureV1(input);
  expect(diagnostic).toEqual({ ok: false, stage: "input", reason: "schema_invalid" });
}

describe("signed target discovery point closure", () => {
  it("performs exactly one active-root point admission and six signature verifications", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    const result = await validateProviderTargetDiscoveryPointClosureV1(request());
    expect(result.authority).toBe("none_target_discovery_point_structure_only");
    expect(pointCalls).toBe(1);
    expect(verifyCalls).toBe(6);
    expect(Object.keys(result.locators)).toEqual([
      "publicSupportTaxonomy",
      "releaseMatrix",
      "targetDiscoveryFixtureManifest",
      "targetDiscoveryRunnerRun",
      "targetDiscoveryResult",
    ]);
  });

  it("keeps the discovery runner profile independent from the real-FS suite runner profile", async () => {
    const input = request();
    expect(input.targetDiscoveryRunnerRun.payload.runnerProfileDigest).not.toBe(
      input.suiteManifest.payload.runnerProfileDigest,
    );
    await expect(validateProviderTargetDiscoveryPointClosureV1(input)).resolves.toMatchObject({
      authority: "none_target_discovery_point_structure_only",
    });
  });

  it("requires complete content-bound Envelopes for all five locator builders", () => {
    expect(() => buildProviderPublicSupportTaxonomyRelativePathV1({
      locatorProfile: "distribution_provider_public_support_taxonomy_v1",
      taxonomyGeneration: 1,
    })).toThrow();
    expect(() => buildProviderReleaseMatrixRelativePathV1({
      locatorProfile: "distribution_provider_release_matrix_v1",
      releaseMatrixGeneration: 1,
    })).toThrow();
    expect(() => buildProviderTargetDiscoveryFixtureManifestRelativePathV1({
      contentDigest: golden.targetDiscoveryFixtureManifest.contentDigest,
    })).toThrow();
    expect(() => buildProviderTargetDiscoveryRunnerRunRelativePathV1({
      runManifestContentDigest: golden.targetDiscoveryRunnerRun.contentDigest,
    })).toThrow();
    expect(() => buildProviderTargetDiscoveryResultRelativePathV1({
      locatorProfile: "distribution_provider_target_discovery_result_v1",
      discoveryGeneration: 1,
    })).toThrow();

    const semanticSubstitution = clone(golden.targetDiscoveryFixtureManifest);
    semanticSubstitution.contentDigest = semanticSubstitution.fixtureManifestDigest;
    expect(() => buildProviderTargetDiscoveryFixtureManifestRelativePathV1(semanticSubstitution)).toThrow();

    const outerSemanticMismatch = clone(golden.targetDiscoveryFixtureManifest);
    outerSemanticMismatch.fixtureManifestDigest = `sha256:${"f".repeat(64)}` as typeof outerSemanticMismatch.fixtureManifestDigest;
    expect(() => buildProviderTargetDiscoveryFixtureManifestRelativePathV1(outerSemanticMismatch)).toThrow();
  });

  it("rejects top-level and nested Proxy values", async () => {
    await expectInputDiagnostic(new Proxy(request(), {}));
    const nested = request();
    nested.targetDiscoveryResult.payload = new Proxy(
      nested.targetDiscoveryResult.payload,
      {},
    );
    await expectInputDiagnostic(nested);
  });

  it("rejects getters without executing them", async () => {
    let getterCalls = 0;
    const topLevel = request() as ValidateProviderTargetDiscoveryPointClosureV1Input & {
      unexpected?: boolean;
    };
    Object.defineProperty(topLevel, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
    await expectInputDiagnostic(topLevel);
    expect(getterCalls).toBe(0);

    const nested = request();
    Object.defineProperty(nested.targetDiscoveryResult.payload, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
    await expectInputDiagnostic(nested);
    expect(getterCalls).toBe(0);
  });

  it("rejects hidden fields, symbols, sparse arrays, cycles and aliases", async () => {
    const hidden = request();
    Object.defineProperty(hidden.targetDiscoveryResult.payload, "hidden", {
      enumerable: false,
      value: true,
    });
    await expectInputDiagnostic(hidden);

    const symbol = request();
    Object.defineProperty(symbol.targetDiscoveryResult.payload, Symbol("hostile"), {
      enumerable: true,
      value: true,
    });
    await expectInputDiagnostic(symbol);

    const sparse = request();
    delete sparse.targetDiscoveryResult.payload.targets[0];
    await expectInputDiagnostic(sparse);

    const cycle = request() as ValidateProviderTargetDiscoveryPointClosureV1Input & {
      targetDiscoveryResult: ValidateProviderTargetDiscoveryPointClosureV1Input["targetDiscoveryResult"] & {
        cycle?: unknown;
      };
    };
    cycle.targetDiscoveryResult.cycle = cycle.targetDiscoveryResult;
    await expectInputDiagnostic(cycle);

    const alias = request();
    alias.targetDiscoveryResult.payload.targets[1] =
      alias.targetDiscoveryResult.payload.targets[0]!;
    await expectInputDiagnostic(alias);
  });

  it("uses an immutable snapshot across asynchronous signature verification", async () => {
    const input = request();
    let reachedResolve!: () => void;
    const reached = new Promise<void>((resolve) => {
      reachedResolve = resolve;
    });
    verificationReached = reachedResolve;
    blockNextVerification = true;
    const pending = validateProviderTargetDiscoveryPointClosureV1(input);
    await reached;
    input.targetDiscoveryResult.payload.targets[0]!.target.osBuildDigest =
      `sha256:${"f".repeat(64)}` as typeof input.targetDiscoveryResult.payload.targets[number]["target"]["osBuildDigest"];
    releaseVerification?.();
    await expect(pending).resolves.toMatchObject({
      authority: "none_target_discovery_point_structure_only",
      targetCount: 2,
    });
    verificationReached = undefined;
    releaseVerification = undefined;
  });

  it("maps every public validation failure to one opaque provider error", async () => {
    const input = request();
    input.targetDiscoveryResult.payload.discoverySignature =
      input.targetDiscoveryResult.payload.discoverySignature.replace(/.$/u, "0") as typeof input.targetDiscoveryResult.payload.discoverySignature;
    await expect(validateProviderTargetDiscoveryPointClosureV1(input)).rejects.toMatchObject({
      name: "ProviderTargetDiscoveryPointClosureValidationError",
      code: "provider_unavailable",
      reason: "attestation_invalid",
      message: "Provider target discovery point closure validation failed",
    });
    await expect(validateProviderTargetDiscoveryPointClosureV1(input)).rejects.toBeInstanceOf(
      ProviderTargetDiscoveryPointClosureValidationError,
    );
  });
});
