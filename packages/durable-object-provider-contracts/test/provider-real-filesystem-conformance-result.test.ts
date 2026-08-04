import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import {
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1,
  ProviderRealFilesystemConformanceResultClosureValidationError,
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
  ProviderRealFilesystemConformanceResultV1Schema,
  buildProviderRealFilesystemConformanceResultRelativePathV1,
  deriveProviderRealFilesystemConformanceResultContentDigestV1,
  deriveProviderRealFilesystemConformanceResultIdV1,
  diagnoseProviderRealFilesystemConformanceResultClosureV1,
  validateProviderRealFilesystemConformanceResultClosureV1,
  type ProviderRealFilesystemConformanceCaseOutcomeV1,
  type ProviderRealFilesystemConformanceCaseResultV1,
  type ProviderRealFilesystemConformanceResultCodeV1,
  type ProviderRealFilesystemConformanceResultV1,
  type ValidateProviderRealFilesystemConformanceResultClosureV1Input,
} from "../src/provider-real-filesystem-conformance-result.js";
import { ProviderTargetDiscoveryPointGoldenManifestV1Schema } from "../src/provider-target-discovery-point-fixtures.js";
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

const discoveryGolden = ProviderTargetDiscoveryPointGoldenManifestV1Schema.parse(
  JSON.parse(
    new TextDecoder().decode(
      resourceBytes("fixtures/v1/golden/provider-target-discovery-point-v1.json"),
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
        ) {
          throw new TypeError("unexpected fixed resource request");
        }
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

function aggregate(
  entries: readonly ProviderRealFilesystemConformanceCaseResultV1[],
): ProviderRealFilesystemConformanceCaseOutcomeV1 {
  if (entries.some((entry) => entry.outcome === "failed")) return "failed";
  if (entries.some((entry) => entry.outcome === "unsupported")) return "unsupported";
  return "passed";
}

const OUTCOME_CODE_MATRIX = (["passed", "failed", "unsupported"] as const).flatMap(
  (outcome) =>
    ([
      "passed",
      "assertion_failed",
      "provider_rejected",
      "crash_recovery_failed",
      "identity_discontinuity",
      "containment_violation",
      "unsupported_by_target_profile",
    ] as const).map((resultCode) => ({
      outcome,
      resultCode,
      valid:
        (outcome === "passed" && resultCode === "passed") ||
        (outcome === "unsupported" && resultCode === "unsupported_by_target_profile") ||
        (outcome === "failed" &&
          resultCode !== "passed" &&
          resultCode !== "unsupported_by_target_profile"),
    })),
);

function appendFreshCaseResults(
  target: ProviderRealFilesystemConformanceCaseResultV1[],
  template: ProviderRealFilesystemConformanceCaseResultV1,
  count: number,
): void {
  for (let remaining = count; remaining > 0; remaining -= 10_000) {
    const chunkLength = Math.min(remaining, 10_000);
    target.push(...Array.from({ length: chunkLength }, () => clone(template)));
  }
}

function materializeExactEnvelopeLimitOverflow(
  envelope: ValidateProviderRealFilesystemConformanceResultClosureV1Input[
    "realFilesystemConformanceResult"
  ],
): void {
  const targetByteLength =
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1 + 1;
  const primary = clone(envelope.payload.caseResults[0]!);
  const secondary: ProviderRealFilesystemConformanceCaseResultV1 = {
    ...clone(primary),
    outcome: "failed",
    resultCode: "assertion_failed",
  };
  envelope.payload.result = "failed";
  const baselineByteLength = canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength;
  const remainingBytes = targetByteLength - baselineByteLength;
  const primaryContribution = canonicalizeJcsSafeIntegerUtf8V1(primary).byteLength + 1;
  const secondaryContribution = canonicalizeJcsSafeIntegerUtf8V1(secondary).byteLength + 1;
  let primaryCount = -1;
  let secondaryCount = -1;
  for (
    let candidateSecondaryCount = 0;
    candidateSecondaryCount < primaryContribution &&
    candidateSecondaryCount * secondaryContribution <= remainingBytes;
    candidateSecondaryCount += 1
  ) {
    const primaryBytes = remainingBytes - candidateSecondaryCount * secondaryContribution;
    if (primaryBytes % primaryContribution === 0) {
      primaryCount = primaryBytes / primaryContribution;
      secondaryCount = candidateSecondaryCount;
      break;
    }
  }
  if (primaryCount < 0 || secondaryCount < 0) {
    throw new TypeError("cannot construct exact MAX+1 test envelope");
  }
  appendFreshCaseResults(envelope.payload.caseResults, primary, primaryCount);
  appendFreshCaseResults(envelope.payload.caseResults, secondary, secondaryCount);
  expect(baselineByteLength).toBe(4_847);
  expect(primaryContribution).toBe(123);
  expect(secondaryContribution).toBe(133);
  expect(canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength).toBe(
    targetByteLength,
  );
}

function completeResult(baseInput: unknown) {
  const base = baseInput as Record<string, unknown> & {
    profile: "provider_real_fs_conformance_result_v1";
    caseResults: ProviderRealFilesystemConformanceCaseResultV1[];
    result?: ProviderRealFilesystemConformanceCaseOutcomeV1;
  };
  const result = base.result ?? aggregate(base.caseResults);
  const { profile: _profile, result: _oldResult, ...fieldsWithoutResult } = base;
  const identityFields = { ...fieldsWithoutResult, result };
  const resultId = deriveProviderRealFilesystemConformanceResultIdV1(identityFields);
  const payload = ProviderRealFilesystemConformanceResultV1Schema.parse({
    ...base,
    result,
    resultId,
  });
  const envelope = ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_real_fs_conformance_result",
    resultId,
    contentDigest: deriveProviderRealFilesystemConformanceResultContentDigestV1(payload),
    payload,
  });
  const locator = ProviderRealFilesystemConformanceResultLocatorV1Schema.parse({
    locatorProfile: "installation_provider_real_fs_conformance_result_v1",
    resultId,
  });
  const pin = ProviderRealFilesystemConformanceResultPinV1Schema.parse({
    ...locator,
    contentDigest: envelope.contentDigest,
  });
  return { envelope, locator, pin };
}

function baseResult() {
  const suite = discoveryGolden.suiteManifest;
  const discovery = discoveryGolden.targetDiscoveryResult;
  const caseResults: ProviderRealFilesystemConformanceCaseResultV1[] = suite.payload.cases.flatMap((suiteCase) =>
    suiteCase.requiredCrashCuts.map((cut) => ({
      caseId: suiteCase.caseId,
      crashCutId: cut.crashCutId,
      outcome: "passed" as const,
      resultCode: "passed" as const,
    })),
  );
  return {
    profile: "provider_real_fs_conformance_result_v1" as const,
    providerId: "durable-object-provider:local-helper" as const,
    semanticProviderPolicyDigest: `sha256:${"a".repeat(64)}` as const,
    implementationDigest: `sha256:${"b".repeat(64)}` as const,
    binaryAttestationDigest: `sha256:${"c".repeat(64)}` as const,
    target: clone(discovery.payload.targets[0]!.target),
    targetDiscoveryResult: {
      locatorProfile: "distribution_provider_target_discovery_result_v1" as const,
      discoveryGeneration: discovery.payload.discoveryGeneration,
      contentDigest: discovery.contentDigest,
    },
    targetDiscoveryInputBundleContentDigest:
      discovery.payload.targetDiscoveryInputBundleContentDigest,
    realFilesystemSuiteManifest: {
      locatorProfile: "distribution_provider_real_fs_suite_manifest_v1" as const,
      distributionRootBinding: clone(suite.payload.distributionRootBinding),
      suiteDigest: suite.payload.suiteDigest,
      fixtureManifestDigest: suite.payload.fixtureCorpusManifest.fixtureManifestDigest,
      contentDigest: suite.contentDigest,
    },
    suiteDigest: suite.payload.suiteDigest,
    fixtureManifestDigest: suite.payload.fixtureCorpusManifest.fixtureManifestDigest,
    runnerProfileDigest: suite.payload.runnerProfileDigest,
    crashCutCoverageDigest: suite.payload.requiredCaseCutSetDigest,
    caseResults,
    completedAt: "2026-08-03T04:00:00Z" as const,
  };
}

function request(): ValidateProviderRealFilesystemConformanceResultClosureV1Input {
  const completed = completeResult(baseResult());
  return {
    distributionRootBinding: clone(discoveryGolden.distributionRootBinding),
    activeRootMetadata: clone(discoveryGolden.activeRootMetadata),
    activeRoot: clone(discoveryGolden.activeRoot),
    fixtureCorpusManifest: clone(discoveryGolden.fixtureCorpusManifest),
    suiteManifest: clone(discoveryGolden.suiteManifest),
    publicSupportTaxonomy: clone(discoveryGolden.publicSupportTaxonomy),
    releaseMatrix: clone(discoveryGolden.releaseMatrix),
    targetDiscoveryFixtureManifest: clone(discoveryGolden.targetDiscoveryFixtureManifest),
    targetDiscoveryRunnerRun: clone(discoveryGolden.targetDiscoveryRunnerRun),
    targetDiscoveryResult: clone(discoveryGolden.targetDiscoveryResult),
    realFilesystemConformanceResult: clone(completed.envelope),
    realFilesystemConformanceResultLocator: clone(completed.locator),
    realFilesystemConformanceResultPin: clone(completed.pin),
    strictCryptoCapability: capability,
  };
}

function replaceResult(
  input: ValidateProviderRealFilesystemConformanceResultClosureV1Input,
  base: unknown,
  explicitResult?: ProviderRealFilesystemConformanceCaseOutcomeV1,
): void {
  const completed = completeResult({ ...(base as Record<string, unknown>), result: explicitResult });
  const mutable = input as {
    realFilesystemConformanceResult: typeof completed.envelope;
    realFilesystemConformanceResultLocator: typeof completed.locator;
    realFilesystemConformanceResultPin: typeof completed.pin;
  };
  mutable.realFilesystemConformanceResult = completed.envelope;
  mutable.realFilesystemConformanceResultLocator = completed.locator;
  mutable.realFilesystemConformanceResultPin = completed.pin;
}

async function expectDiagnostic(
  input: unknown,
  stage: string,
  reason: string,
): Promise<void> {
  await expect(diagnoseProviderRealFilesystemConformanceResultClosureV1(input)).resolves.toEqual({
    ok: false,
    stage,
    reason,
  });
}

async function expectOpaquePublicFailure(input: unknown): Promise<void> {
  try {
    await validateProviderRealFilesystemConformanceResultClosureV1(
      input as ValidateProviderRealFilesystemConformanceResultClosureV1Input,
    );
  } catch (error) {
    expect(error).toBeInstanceOf(
      ProviderRealFilesystemConformanceResultClosureValidationError,
    );
    expect(error).toMatchObject({
      name: "ProviderRealFilesystemConformanceResultClosureValidationError",
      code: "provider_unavailable",
      reason: "attestation_invalid",
      message: "Provider real filesystem conformance result closure validation failed",
    });
    return;
  }
  throw new Error("invalid outcome/code combination was accepted");
}

describe("real filesystem conformance result point closure", () => {
  it("performs exactly one point admission and six signatures without a seventh signature", async () => {
    pointCalls = 0;
    verifyCalls = 0;
    const input = request();
    expect(Object.keys(input.realFilesystemConformanceResult.payload)).not.toContain("signature");
    const validated = await validateProviderRealFilesystemConformanceResultClosureV1(input);
    expect(validated.authority).toBe("none_real_fs_conformance_result_structure_only");
    expect(validated.result).toEqual(input.realFilesystemConformanceResultPin);
    expect(validated.caseResultCount).toBe(8);
    expect(pointCalls).toBe(1);
    expect(verifyCalls).toBe(6);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.targetDiscoveryPoint)).toBe(true);
  });

  it("pins the Suite runner profile and never the independent discovery runner profile", async () => {
    const input = request();
    expect(input.suiteManifest.payload.runnerProfileDigest).not.toBe(
      input.targetDiscoveryRunnerRun.payload.runnerProfileDigest,
    );
    expect(input.realFilesystemConformanceResult.payload.runnerProfileDigest).toBe(
      input.suiteManifest.payload.runnerProfileDigest,
    );
    await expect(validateProviderRealFilesystemConformanceResultClosureV1(input)).resolves.toMatchObject({
      authority: "none_real_fs_conformance_result_structure_only",
    });
  });

  it("requires the target ID to recompute and exact bytes to match one discovered target", async () => {
    const wrongIdentity = request();
    wrongIdentity.realFilesystemConformanceResult.payload.target.osBuildDigest =
      `sha256:${"f".repeat(64)}` as typeof wrongIdentity.realFilesystemConformanceResult.payload.target.osBuildDigest;
    await expectDiagnostic(wrongIdentity, "target_identity", "identity_mismatch");

    const notDiscovered = request();
    const base = baseResult();
    base.target = clone(base.target);
    base.target.osBuildDigest = `sha256:${"e".repeat(64)}` as typeof base.target.osBuildDigest;
    const { targetProfileId: _old, ...fields } = base.target;
    const discoveredTarget = clone(discoveryGolden.targetDiscoveryResult.payload.targets[0]!.target);
    base.target.targetProfileId = discoveredTarget.targetProfileId;
    base.target.targetProfileId = (await import("../src/provider-target-discovery-point.js")).deriveProviderTargetProfileIdV1(fields);
    replaceResult(notDiscovered, base);
    await expectDiagnostic(notDiscovered, "target_membership", "membership_mismatch");
  });

  it("closes Discovery, Bundle, Suite, Corpus, runner and crash-cut digest equalities", async () => {
    for (const [mutate, stage, reason] of [
      [(value: ReturnType<typeof request>) => {
        value.realFilesystemConformanceResult.payload.targetDiscoveryResult.contentDigest = `sha256:${"d".repeat(64)}` as typeof value.realFilesystemConformanceResult.payload.targetDiscoveryResult.contentDigest;
      }, "discovery_pin", "binding_mismatch"],
      [(value: ReturnType<typeof request>) => {
        value.realFilesystemConformanceResult.payload.targetDiscoveryInputBundleContentDigest = `sha256:${"d".repeat(64)}` as typeof value.realFilesystemConformanceResult.payload.targetDiscoveryInputBundleContentDigest;
      }, "discovery_pin", "binding_mismatch"],
      [(value: ReturnType<typeof request>) => {
        value.realFilesystemConformanceResult.payload.realFilesystemSuiteManifest.contentDigest = `sha256:${"d".repeat(64)}` as typeof value.realFilesystemConformanceResult.payload.realFilesystemSuiteManifest.contentDigest;
      }, "suite_pin", "binding_mismatch"],
      [(value: ReturnType<typeof request>) => {
        value.realFilesystemConformanceResult.payload.runnerProfileDigest = value.targetDiscoveryRunnerRun.payload.runnerProfileDigest;
      }, "source_digests", "digest_mismatch"],
    ] as const) {
      const input = request();
      mutate(input);
      await expectDiagnostic(input, stage, reason);
    }
  });

  it("requires tuple-sorted unique exact coverage", async () => {
    const reordered = request();
    reordered.realFilesystemConformanceResult.payload.caseResults.reverse();
    await expectDiagnostic(reordered, "case_coverage", "ordering_invalid");

    const missing = request();
    missing.realFilesystemConformanceResult.payload.caseResults.pop();
    await expectDiagnostic(missing, "case_coverage", "coverage_mismatch");
  });

  it.each(OUTCOME_CODE_MATRIX)(
    "closes outcome/resultCode $outcome/$resultCode (valid=$valid)",
    async ({ outcome, resultCode, valid }) => {
      const input = request();
      const base = baseResult();
      base.caseResults[0] = {
        ...base.caseResults[0]!,
        outcome,
        resultCode,
      };
      replaceResult(input, base);
      expect(input.realFilesystemConformanceResult.payload.result).toBe(outcome);
      if (valid) {
        await expect(
          validateProviderRealFilesystemConformanceResultClosureV1(input),
        ).resolves.toMatchObject({
          authority: "none_real_fs_conformance_result_structure_only",
        });
        return;
      }
      await expectDiagnostic(input, "case_outcome", "outcome_code_mismatch");
      await expectOpaquePublicFailure(input);
    },
  );

  it("derives the aggregate as failed, then unsupported, then passed", async () => {
    const passed = request();
    await expect(validateProviderRealFilesystemConformanceResultClosureV1(passed)).resolves.toMatchObject({
      passedCaseResultCount: 8,
      failedCaseResultCount: 0,
      unsupportedCaseResultCount: 0,
    });

    const unsupported = request();
    const unsupportedBase = baseResult();
    unsupportedBase.caseResults[0] = {
      ...unsupportedBase.caseResults[0]!,
      outcome: "unsupported",
      resultCode: "unsupported_by_target_profile",
    };
    replaceResult(unsupported, unsupportedBase);
    await expect(validateProviderRealFilesystemConformanceResultClosureV1(unsupported)).resolves.toMatchObject({
      unsupportedCaseResultCount: 1,
    });

    const failed = request();
    const failedBase = unsupportedBase;
    failedBase.caseResults[1] = {
      ...failedBase.caseResults[1]!,
      outcome: "failed",
      resultCode: "assertion_failed",
    };
    replaceResult(failed, failedBase);
    await expect(validateProviderRealFilesystemConformanceResultClosureV1(failed)).resolves.toMatchObject({
      failedCaseResultCount: 1,
      unsupportedCaseResultCount: 1,
    });

    const forgedAggregate = request();
    const forgedBase = baseResult();
    replaceResult(forgedAggregate, forgedBase, "failed");
    await expectDiagnostic(forgedAggregate, "aggregate", "aggregate_mismatch");
  });

  it("closes ID, content digest, Envelope, Locator, Pin and the one encoded path", async () => {
    const input = request();
    const validated = await validateProviderRealFilesystemConformanceResultClosureV1(input);
    expect(validated.locator).toEqual(input.realFilesystemConformanceResultLocator);
    expect(validated.relativePath).toMatch(
      /^provider\/real-fs-conformance-results\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u,
    );
    expect(buildProviderRealFilesystemConformanceResultRelativePathV1(
      input.realFilesystemConformanceResultLocator,
    )).toBe(validated.relativePath);
    expect(() => buildProviderRealFilesystemConformanceResultRelativePathV1(
      input.realFilesystemConformanceResult,
    )).toThrow();
    expect(() => buildProviderRealFilesystemConformanceResultRelativePathV1(
      input.realFilesystemConformanceResultPin,
    )).toThrow();
    expect(() => buildProviderRealFilesystemConformanceResultRelativePathV1({
      ...input.realFilesystemConformanceResultLocator,
      path: "provider/real-fs-conformance-results/latest.json",
    })).toThrow();

    const wrongPin = request();
    wrongPin.realFilesystemConformanceResultPin.contentDigest = `sha256:${"0".repeat(64)}` as typeof wrongPin.realFilesystemConformanceResultPin.contentDigest;
    await expectDiagnostic(wrongPin, "locator", "locator_mismatch");

    const wrongOuter = request();
    wrongOuter.realFilesystemConformanceResult.resultId = `provider-real-fs-result:${"0".repeat(22)}` as typeof wrongOuter.realFilesystemConformanceResult.resultId;
    await expectDiagnostic(wrongOuter, "result_envelope", "envelope_mismatch");
  });

  it("enforces the 16 MiB materialized Envelope without an independent case cap", async () => {
    const input = request();
    materializeExactEnvelopeLimitOverflow(input.realFilesystemConformanceResult);
    expect(
      canonicalizeJcsSafeIntegerUtf8V1(input.realFilesystemConformanceResult).byteLength,
    ).toBe(PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1 + 1);
    await expectDiagnostic(input, "envelope_limit", "byte_limit_exceeded");
  }, 30_000);

  it("rejects Proxy/getter/hidden/symbol/sparse/cycle/alias before validation", async () => {
    await expectDiagnostic(new Proxy(request(), {}), "input", "schema_invalid");

    let getterCalls = 0;
    const getter = request() as ValidateProviderRealFilesystemConformanceResultClosureV1Input & {
      unexpected?: boolean;
    };
    Object.defineProperty(getter, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
    await expectDiagnostic(getter, "input", "schema_invalid");
    expect(getterCalls).toBe(0);

    const hidden = request();
    Object.defineProperty(hidden.realFilesystemConformanceResult.payload, "hidden", {
      enumerable: false,
      value: true,
    });
    await expectDiagnostic(hidden, "input", "schema_invalid");

    const symbol = request();
    Object.defineProperty(symbol.realFilesystemConformanceResult.payload, Symbol("hostile"), {
      enumerable: true,
      value: true,
    });
    await expectDiagnostic(symbol, "input", "schema_invalid");

    const sparse = request();
    delete sparse.realFilesystemConformanceResult.payload.caseResults[0];
    await expectDiagnostic(sparse, "input", "schema_invalid");

    const cycle = request() as ValidateProviderRealFilesystemConformanceResultClosureV1Input & {
      cycle?: unknown;
    };
    cycle.cycle = cycle;
    await expectDiagnostic(cycle, "input", "schema_invalid");

    const alias = request();
    alias.realFilesystemConformanceResult.payload.target =
      alias.targetDiscoveryResult.payload.targets[0]!.target;
    await expectDiagnostic(alias, "input", "schema_invalid");
  });

  it("uses one immutable snapshot across the asynchronous nested signature boundary", async () => {
    const input = request();
    let reachedResolve!: () => void;
    const reached = new Promise<void>((resolve) => {
      reachedResolve = resolve;
    });
    verificationReached = reachedResolve;
    blockNextVerification = true;
    const pending = validateProviderRealFilesystemConformanceResultClosureV1(input);
    await reached;
    input.realFilesystemConformanceResult.payload.result = "failed";
    input.realFilesystemConformanceResult.payload.caseResults[0]!.outcome = "failed";
    input.realFilesystemConformanceResult.payload.caseResults[0]!.resultCode = "assertion_failed";
    releaseVerification?.();
    await expect(pending).resolves.toMatchObject({
      authority: "none_real_fs_conformance_result_structure_only",
      passedCaseResultCount: 8,
    });
    verificationReached = undefined;
    releaseVerification = undefined;
  });

  it("keeps public failure opaque", async () => {
    const input = request();
    input.realFilesystemConformanceResult.payload.result = "failed";
    const diagnostic = await diagnoseProviderRealFilesystemConformanceResultClosureV1(input);
    expect(diagnostic).toEqual({ ok: false, stage: "aggregate", reason: "aggregate_mismatch" });
    await expect(validateProviderRealFilesystemConformanceResultClosureV1(input)).rejects.toMatchObject({
      name: "ProviderRealFilesystemConformanceResultClosureValidationError",
      code: "provider_unavailable",
      reason: "attestation_invalid",
      message: "Provider real filesystem conformance result closure validation failed",
    });
    await expect(validateProviderRealFilesystemConformanceResultClosureV1(input)).rejects.toBeInstanceOf(
      ProviderRealFilesystemConformanceResultClosureValidationError,
    );
  });
});
