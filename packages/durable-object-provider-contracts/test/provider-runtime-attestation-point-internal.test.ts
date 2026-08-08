import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  DurableObjectIdentityProviderIdV1Schema,
  ProviderRegistryManifestGenerationIdV1Schema,
  type ContentDigestV1,
} from "../src/primitives.js";
import type { ProviderRegistryManifestHistoryValidationV1 } from "../src/provider-registry-manifest-history.js";
import {
  createRegistryHistoryVerifiedCryptoWitnessInternalV1,
  discardRegistryHistoryVerifiedWitnessInternalV1,
  registerRegistryHistoryVerifiedWitnessInternalV1,
  type RegistryHistoryVerifiedTipEntryV1,
} from "../src/provider-registry-history-prepared-handle-internal.js";
import {
  ProviderRuntimeAttestationPointGoldenManifestV1Schema,
  type ProviderRuntimeAttestationPointGoldenManifestV1,
} from "../src/provider-runtime-attestation-point-fixtures.js";
import {
  diagnoseProviderRuntimeAttestationPointFromRegistryHistoryInternalV1,
} from "../src/provider-runtime-attestation-point-internal.js";
import type { ValidateProviderRuntimeAttestationPointClosureV1Input } from "../src/provider-runtime-attestation-point.js";
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreezeJsonV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeJsonV1(child);
    Object.freeze(value);
  }
  return value;
}

const golden = ProviderRuntimeAttestationPointGoldenManifestV1Schema.parse(
  JSON.parse(
    new TextDecoder().decode(
      resourceBytes(
        "fixtures/v1/golden/provider-runtime-attestation-point-v1.json",
      ),
    ),
  ),
);
const strictManifestBytes = resourceBytes(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);

let pointCalls = 0;
let verifyCalls = 0;
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

function mutableRequestFromGoldenV1(
  manifest: ProviderRuntimeAttestationPointGoldenManifestV1,
): ValidateProviderRuntimeAttestationPointClosureV1Input {
  const source = manifest.conformanceResultGolden;
  return {
    activeRoot: clone(source.activeRoot),
    activeRootMetadata: clone(source.activeRootMetadata),
    distributionRootBinding: clone(source.distributionRootBinding),
    fixtureCorpusManifest: clone(source.fixtureCorpusManifest),
    publicSupportTaxonomy: clone(source.publicSupportTaxonomy),
    realFilesystemConformanceResult: clone(
      manifest.realFilesystemConformanceResult,
    ),
    realFilesystemConformanceResultLocator: clone(
      manifest.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: clone(
      manifest.realFilesystemConformanceResultPin,
    ),
    releaseMatrix: clone(source.releaseMatrix),
    runtimeAttestation: clone(manifest.runtimeAttestation),
    semanticProviderPolicy: clone(manifest.semanticProviderPolicy),
    strictCryptoCapability: capability,
    suiteManifest: clone(source.suiteManifest),
    targetDiscoveryFixtureManifest: clone(source.targetDiscoveryFixtureManifest),
    targetDiscoveryResult: clone(source.targetDiscoveryResult),
    targetDiscoveryRunnerRun: clone(source.targetDiscoveryRunnerRun),
  };
}

function preparedRequestV1(
  mutate?: (request: ValidateProviderRuntimeAttestationPointClosureV1Input) => void,
): ValidateProviderRuntimeAttestationPointClosureV1Input {
  const request = mutableRequestFromGoldenV1(golden);
  mutate?.(request);
  for (const [key, value] of Object.entries(request)) {
    if (key !== "strictCryptoCapability") deepFreezeJsonV1(value);
  }
  return Object.freeze(request);
}

function registryClosureV1(): ProviderRegistryManifestHistoryValidationV1 {
  return Object.freeze({
    authority: "none_registry_structure_and_history_only" as const,
  }) as unknown as ProviderRegistryManifestHistoryValidationV1;
}

interface RegisteredWitnessV1 {
  readonly closure: ProviderRegistryManifestHistoryValidationV1;
  readonly handle: ReturnType<
    typeof registerRegistryHistoryVerifiedWitnessInternalV1
  >;
  readonly selectedEntry: RegistryHistoryVerifiedTipEntryV1;
  readonly approvers: readonly never[];
  readonly selectedEntryContentDigest: ContentDigestV1;
}

function registerWitnessV1(
  request: ValidateProviderRuntimeAttestationPointClosureV1Input,
): RegisteredWitnessV1 {
  const closure = registryClosureV1();
  const selectedEntryContentDigest =
    request.realFilesystemConformanceResult.contentDigest;
  const approvers = Object.freeze([]);
  const selectedEntry = Object.freeze({
    providerId: request.runtimeAttestation.payload.providerId,
    registryEntryContentDigest: selectedEntryContentDigest,
    runtimeAttestation: request.runtimeAttestation,
    historicallyVerifiedApproverPublicKeys: approvers,
  });
  const verifiedTipEntries = Object.freeze([selectedEntry]);
  const witness = createRegistryHistoryVerifiedCryptoWitnessInternalV1({
    strictCryptoCapability: capability,
    suppliedHistoryTipRoot: request.activeRoot,
    tipManifestGenerationId:
      ProviderRegistryManifestGenerationIdV1Schema.parse(
        `provider-registry-manifest:${"a".repeat(22)}`,
      ),
    tipManifestContentDigest:
      request.realFilesystemConformanceResult.contentDigest,
    verifiedTipEntries,
  });
  const handle = registerRegistryHistoryVerifiedWitnessInternalV1(
    closure,
    witness,
    capability,
  );
  return {
    closure,
    handle,
    selectedEntry,
    approvers,
    selectedEntryContentDigest,
  };
}

async function invokePreparedV1(
  request: ValidateProviderRuntimeAttestationPointClosureV1Input,
  registered: RegisteredWitnessV1,
  capabilityIdentity = capability,
) {
  return diagnoseProviderRuntimeAttestationPointFromRegistryHistoryInternalV1(
    request,
    registered.closure,
    registered.handle,
    request.runtimeAttestation.payload.providerId,
    registered.selectedEntryContentDigest,
    capabilityIdentity,
  );
}

function corruptSignatureV1(signature: string): string {
  const last = signature.at(-1);
  return `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

function expectZeroCopyLedgerV1(value: {
  readonly preparedHistorySnapshotAttemptCount: 0;
  readonly retainedParallelHistoryGraphCount: 0;
  readonly nestedPreparedSnapshotAttemptCount: 0;
}): void {
  expect(value).toEqual({
    preparedHistorySnapshotAttemptCount: 0,
    retainedParallelHistoryGraphCount: 0,
    nestedPreparedSnapshotAttemptCount: 0,
  });
  expect(Object.isFrozen(value)).toBe(true);
}

describe("prepared provider Runtime attestation history reuse", () => {
  it("reuses Registry crypto and closes I -> H -> G -> F with zero points and exactly six signatures", async () => {
    const request = preparedRequestV1();
    const registered = registerWitnessV1(request);
    pointCalls = 0;
    verifyCalls = 0;

    const result = await invokePreparedV1(request, registered);

    expect(result.ok).toBe(true);
    expect(result.sourceSignatureVerificationPrefix).toBe(6);
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(6);
    expectZeroCopyLedgerV1(result.copyLedger);
    if (!result.ok) throw new TypeError("prepared Runtime unexpectedly failed");
    expect(result.value.copyLedger).toBe(result.copyLedger);
    expect(result.value.suppliedHistoryTipRoot).toBe(request.activeRoot);
    expect(result.value.verifiedSelectedEntry).toBe(registered.selectedEntry);
    expect(result.value.historicallyVerifiedApproverPublicKeys).toBe(
      registered.approvers,
    );
    expect(result.value.runtimeAttestationPointClosure.semanticProviderPolicy).toBe(
      request.semanticProviderPolicy,
    );
    expect(result.value.runtimeAttestationPointClosure.runtimeAttestation).toBe(
      request.runtimeAttestation,
    );
    expect(
      result.value.runtimeAttestationPointClosure.conformanceResultClosure
        .targetDiscoveryPoint.distributionRootBinding,
    ).toBe(request.distributionRootBinding);
    expect(
      result.value.runtimeAttestationPointClosure.conformanceResultClosure
        .targetDiscoveryPoint.activeRootMetadata,
    ).toBe(request.activeRootMetadata);
  });

  it("returns approver records from the selected non-first Entry", async () => {
    const request = preparedRequestV1();
    const closure = registryClosureV1();
    const firstApprovers = Object.freeze([]);
    const selectedApprovers = Object.freeze([]);
    const selectedEntryContentDigest =
      request.realFilesystemConformanceResult.contentDigest;
    const firstEntry = Object.freeze({
      providerId: DurableObjectIdentityProviderIdV1Schema.parse(
        "durable-object-provider:synthetic-first",
      ),
      registryEntryContentDigest: selectedEntryContentDigest,
      runtimeAttestation: request.runtimeAttestation,
      historicallyVerifiedApproverPublicKeys: firstApprovers,
    });
    const selectedEntry = Object.freeze({
      providerId: request.runtimeAttestation.payload.providerId,
      registryEntryContentDigest: selectedEntryContentDigest,
      runtimeAttestation: request.runtimeAttestation,
      historicallyVerifiedApproverPublicKeys: selectedApprovers,
    });
    const witness = createRegistryHistoryVerifiedCryptoWitnessInternalV1({
      strictCryptoCapability: capability,
      suppliedHistoryTipRoot: request.activeRoot,
      tipManifestGenerationId:
        ProviderRegistryManifestGenerationIdV1Schema.parse(
          `provider-registry-manifest:${"b".repeat(22)}`,
        ),
      tipManifestContentDigest: selectedEntryContentDigest,
      verifiedTipEntries: Object.freeze([firstEntry, selectedEntry]),
    });
    const handle = registerRegistryHistoryVerifiedWitnessInternalV1(
      closure,
      witness,
      capability,
    );
    pointCalls = 0;
    verifyCalls = 0;

    const result =
      await diagnoseProviderRuntimeAttestationPointFromRegistryHistoryInternalV1(
        request,
        closure,
        handle,
        selectedEntry.providerId,
        selectedEntry.registryEntryContentDigest,
        capability,
      );

    expect(result.ok).toBe(true);
    expect(result.sourceSignatureVerificationPrefix).toBe(6);
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(6);
    expectZeroCopyLedgerV1(result.copyLedger);
    if (!result.ok) throw new TypeError("prepared Runtime unexpectedly failed");
    expect(result.value.verifiedSelectedEntry).toBe(selectedEntry);
    expect(result.value.historicallyVerifiedApproverPublicKeys).toBe(
      selectedApprovers,
    );
    expect(result.value.historicallyVerifiedApproverPublicKeys).not.toBe(
      firstApprovers,
    );
  });

  it("never calls a nested structuredClone and consumes the witness on success", async () => {
    const request = preparedRequestV1();
    const registered = registerWitnessV1(request);
    const originalStructuredClone = globalThis.structuredClone;
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      writable: true,
      value() {
        throw new TypeError("prepared path attempted structuredClone");
      },
    });
    try {
      const first = await invokePreparedV1(request, registered);
      expect(first.ok).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "structuredClone", {
        configurable: true,
        writable: true,
        value: originalStructuredClone,
      });
    }
    pointCalls = 0;
    verifyCalls = 0;
    const replay = await invokePreparedV1(request, registered);
    expect(replay).toMatchObject({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
      sourceSignatureVerificationPrefix: 0,
    });
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);
  });

  it("consumes the exact closure entry before rejecting a wrong handle or capability", async () => {
    const request = preparedRequestV1();
    const first = registerWitnessV1(request);
    const second = registerWitnessV1(request);

    const wrongHandle = await diagnoseProviderRuntimeAttestationPointFromRegistryHistoryInternalV1(
      request,
      first.closure,
      second.handle,
      request.runtimeAttestation.payload.providerId,
      first.selectedEntryContentDigest,
      capability,
    );
    expect(wrongHandle.ok).toBe(false);
    const firstReplay = await invokePreparedV1(request, first);
    expect(firstReplay.ok).toBe(false);
    expect(firstReplay.sourceSignatureVerificationPrefix).toBe(0);

    const third = registerWitnessV1(request);
    const fakeCapability = Object.freeze({}) as unknown as
      ProviderStrictEd25519OpaqueCapabilityV1;
    const wrongCapability = await invokePreparedV1(
      request,
      third,
      fakeCapability,
    );
    expect(wrongCapability.ok).toBe(false);
    const thirdReplay = await invokePreparedV1(request, third);
    expect(thirdReplay.ok).toBe(false);
    expect(thirdReplay.sourceSignatureVerificationPrefix).toBe(0);

    expect(
      discardRegistryHistoryVerifiedWitnessInternalV1(
        second.closure,
        second.handle,
        capability,
      ),
    ).toBe(true);
  });

  it("rejects a non-identical Runtime Pin before distribution crypto", async () => {
    const witnessRequest = preparedRequestV1();
    const registered = registerWitnessV1(witnessRequest);
    const request = preparedRequestV1((candidate) => {
      (candidate as unknown as Record<string, unknown>).activeRoot =
        witnessRequest.activeRoot;
    });
    pointCalls = 0;
    verifyCalls = 0;

    const result = await invokePreparedV1(request, registered);

    expect(result).toMatchObject({
      ok: false,
      stage: "runtime_result_binding",
      reason: "binding_mismatch",
      sourceSignatureVerificationPrefix: 0,
    });
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(0);
  });

  it.each([
    [1, (request: ValidateProviderRuntimeAttestationPointClosureV1Input) => {
      const payload = request.fixtureCorpusManifest.payload as unknown as Record<string, string>;
      payload.corpusSignature = corruptSignatureV1(payload.corpusSignature!);
    }],
    [2, (request: ValidateProviderRuntimeAttestationPointClosureV1Input) => {
      const payload = request.suiteManifest.payload as unknown as Record<string, string>;
      payload.suiteSignature = corruptSignatureV1(payload.suiteSignature!);
    }],
    [3, (request: ValidateProviderRuntimeAttestationPointClosureV1Input) => {
      const payload = request.publicSupportTaxonomy.payload as unknown as Record<string, string>;
      payload.taxonomySignature = corruptSignatureV1(payload.taxonomySignature!);
    }],
    [4, (request: ValidateProviderRuntimeAttestationPointClosureV1Input) => {
      const payload = request.releaseMatrix.payload as unknown as Record<string, string>;
      payload.matrixSignature = corruptSignatureV1(payload.matrixSignature!);
    }],
    [5, (request: ValidateProviderRuntimeAttestationPointClosureV1Input) => {
      const bundle = request.targetDiscoveryResult.payload
        .targetDiscoveryInputBundle as unknown as Record<string, string>;
      bundle.bundleSignature = corruptSignatureV1(bundle.bundleSignature!);
    }],
    [6, (request: ValidateProviderRuntimeAttestationPointClosureV1Input) => {
      const payload = request.targetDiscoveryResult.payload as unknown as Record<string, string>;
      payload.discoverySignature = corruptSignatureV1(payload.discoverySignature!);
    }],
  ] as const)(
    "reports the actual failed distribution verify in prefix position %i",
    async (expectedPrefix, mutate) => {
      const request = preparedRequestV1(mutate);
      const registered = registerWitnessV1(request);
      pointCalls = 0;
      verifyCalls = 0;

      const result = await invokePreparedV1(request, registered);

      expect(result).toMatchObject({
        ok: false,
        stage: "conformance_result_closure",
        reason: "source_invalid",
        sourceSignatureVerificationPrefix: expectedPrefix,
      });
      expect(pointCalls).toBe(0);
      expect(verifyCalls).toBe(expectedPrefix);
      expectZeroCopyLedgerV1(result.copyLedger);
    },
  );

  it("keeps the completed prefix for non-crypto failures after a distribution verify", async () => {
    const request = preparedRequestV1((candidate) => {
      (candidate.fixtureCorpusManifest as unknown as Record<string, unknown>)
        .contentDigest = `sha256:${"f".repeat(64)}`;
    });
    const registered = registerWitnessV1(request);
    pointCalls = 0;
    verifyCalls = 0;

    const result = await invokePreparedV1(request, registered);

    expect(result).toMatchObject({
      ok: false,
      stage: "conformance_result_closure",
      reason: "source_invalid",
      sourceSignatureVerificationPrefix: 1,
    });
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(1);
  });

  it("keeps prefix six when Runtime semantics fail after the complete source chain", async () => {
    const request = preparedRequestV1((candidate) => {
      (candidate.semanticProviderPolicy as unknown as Record<string, unknown>)
        .protocolVersion = 2;
    });
    const registered = registerWitnessV1(request);
    pointCalls = 0;
    verifyCalls = 0;

    const result = await invokePreparedV1(request, registered);

    expect(result).toMatchObject({
      ok: false,
      stage: "semantic_policy_structure",
      reason: "schema_invalid",
      sourceSignatureVerificationPrefix: 6,
    });
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(6);
  });

  it("isolates concurrent invocations that share the same capability", async () => {
    const leftRequest = preparedRequestV1();
    const rightRequest = preparedRequestV1();
    const left = registerWitnessV1(leftRequest);
    const right = registerWitnessV1(rightRequest);
    pointCalls = 0;
    verifyCalls = 0;

    const [leftResult, rightResult] = await Promise.all([
      invokePreparedV1(leftRequest, left),
      invokePreparedV1(rightRequest, right),
    ]);

    expect(leftResult.ok).toBe(true);
    expect(rightResult.ok).toBe(true);
    expect(leftResult.sourceSignatureVerificationPrefix).toBe(6);
    expect(rightResult.sourceSignatureVerificationPrefix).toBe(6);
    expect(pointCalls).toBe(0);
    expect(verifyCalls).toBe(12);
  });
});
