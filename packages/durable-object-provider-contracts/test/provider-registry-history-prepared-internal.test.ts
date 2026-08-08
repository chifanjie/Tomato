import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import type { ProviderBootstrapTrustBundleV1 } from "../src/bootstrap-trust-bundle.js";
import {
  validateProviderRegistryManifestHistoryV1,
  type ProviderRegistryManifestHistoryValidationV1,
  type ValidateProviderRegistryManifestHistoryV1Input,
} from "../src/provider-registry-manifest-history.js";
import {
  createPreparedRegistryHistorySnapshotInternalV1,
  diagnoseProviderRegistryManifestHistoryPreparedInternalV1,
  discardPreparedRegistryHistoryInputInternalV1,
  discardRegistryHistoryVerifiedWitnessInternalV1,
  registerPreparedRegistryHistoryInputInternalV1,
  takeRegistryHistoryVerifiedWitnessInternalV1,
  type PreparedRegistryHistoryInputHandleV1,
  type RegistryTrustWitnessHandleV1,
} from "../src/provider-registry-history-prepared-internal.js";
import type { ProviderRegistryManifestEnvelopeV1 } from "../src/provider-registry-records.js";
import type { ProviderRegistryRootMetadataEnvelopeV1 } from "../src/provider-registry-trust.js";
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

interface RegistryHistoryPreparedFixtureV1 {
  readonly installationIdentityGenerationId:
    ValidateProviderRegistryManifestHistoryV1Input["installationIdentityGenerationId"];
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly registryManifestHistory: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly expected: {
    readonly cryptoClosure: {
      readonly postAttestationPointCalls: number;
      readonly postAttestationSignatureCalls: number;
    };
  };
}

interface DetachedRegistryPreparedFieldsV1 {
  installationIdentityGenerationId:
    ValidateProviderRegistryManifestHistoryV1Input["installationIdentityGenerationId"];
  bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  rootMetadataHistory: ProviderRegistryRootMetadataEnvelopeV1[];
  registryManifestHistory: ProviderRegistryManifestEnvelopeV1[];
}

interface PreparedInvocationV1 {
  readonly requestIdentity: Readonly<
    ValidateProviderRegistryManifestHistoryV1Input
  >;
  readonly inputHandle: PreparedRegistryHistoryInputHandleV1;
  readonly detached: Readonly<DetachedRegistryPreparedFieldsV1>;
}

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as RegistryHistoryPreparedFixtureV1;

const strictManifestBytes = new Uint8Array(
  readFileSync(
    fileURLToPath(
      new URL(
        "../provider/ed25519-strict-host-conformance-v1.json",
        import.meta.url,
      ),
    ),
  ),
);

let capability: ProviderStrictEd25519OpaqueCapabilityV1;
let pointCalls = 0;
let signatureCalls = 0;

function resetCryptoCalls(): void {
  pointCalls = 0;
  signatureCalls = 0;
}

function recursivelyFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor) {
        recursivelyFreeze(descriptor.value);
      }
    }
    Object.freeze(value);
  }
  return value;
}

function createPreparedInvocation(
  mutate?: (draft: DetachedRegistryPreparedFieldsV1) => void,
): PreparedInvocationV1 {
  const detached = structuredClone({
    installationIdentityGenerationId:
      fixture.installationIdentityGenerationId,
    bootstrapTrustBundle: fixture.bootstrapTrustBundle,
    rootMetadataHistory: fixture.rootMetadataHistory,
    registryManifestHistory: fixture.registryManifestHistory,
  }) as DetachedRegistryPreparedFieldsV1;
  mutate?.(detached);
  recursivelyFreeze(detached);

  const requestIdentity = Object.freeze({
    bootstrapTrustBundle: detached.bootstrapTrustBundle,
    installationIdentityGenerationId:
      detached.installationIdentityGenerationId,
    registryManifestHistory: detached.registryManifestHistory,
    rootMetadataHistory: detached.rootMetadataHistory,
    strictCryptoCapability: capability,
  });
  const snapshot = createPreparedRegistryHistorySnapshotInternalV1({
    installationIdentityGenerationId:
      detached.installationIdentityGenerationId,
    bootstrapTrustBundle: detached.bootstrapTrustBundle,
    rootMetadataHistory: detached.rootMetadataHistory,
    registryManifestHistory: detached.registryManifestHistory,
    strictCryptoCapability: capability,
  });
  const inputHandle = registerPreparedRegistryHistoryInputInternalV1(
    requestIdentity,
    snapshot,
    capability,
  );
  return { requestIdentity, inputHandle, detached };
}

function fakeOpaqueIdentity<T extends object>(): T {
  return Object.freeze(Object.create(null)) as T;
}

function expectHistoryCryptoCalls(multiplier = 1): void {
  expect(pointCalls).toBe(
    fixture.expected.cryptoClosure.postAttestationPointCalls * multiplier,
  );
  expect(signatureCalls).toBe(
    fixture.expected.cryptoClosure.postAttestationSignatureCalls * multiplier,
  );
}

function expectPreparedFailure(
  result: Awaited<
    ReturnType<
      typeof diagnoseProviderRegistryManifestHistoryPreparedInternalV1
    >
  >,
  stage = "history_input",
  reason = "schema_invalid",
): void {
  expect(result).toEqual({ ok: false, stage, reason });
}

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: {
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(point) {
        pointCalls += 1;
        return validatePrimeSubgroupPoint(point);
      },
      verifyRawEd25519(publicKey, message, signature) {
        signatureCalls += 1;
        return verifyRawEd25519(publicKey, message, signature);
      },
    },
    resourceHost: {
      readFixedSignedPackageResource(path, maxBytes) {
        expect(path).toBe(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
        expect(maxBytes).toBe(PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1);
        return strictManifestBytes.slice();
      },
    },
  });
});

describe("prepared Registry/Root retained-history internals", () => {
  it("keeps the exact detached histories, preserves 24/38, and yields a distinct one-shot witness", async () => {
    const prepared = createPreparedInvocation();
    const impostorRequest = Object.freeze({ ...prepared.requestIdentity });
    resetCryptoCalls();

    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        impostorRequest,
        prepared.inputHandle,
        capability,
      ),
    );
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(0);

    const result =
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectHistoryCryptoCalls();

    const { closure, copyLedger, registryTrustWitnessHandle } = result.value;
    expect(closure.rootMetadataHistory).toBe(
      prepared.detached.rootMetadataHistory,
    );
    expect(closure.registryManifestHistory).toBe(
      prepared.detached.registryManifestHistory,
    );
    for (
      let index = 0;
      index < prepared.detached.rootMetadataHistory.length;
      index += 1
    ) {
      expect(closure.rootMetadataHistory[index]).toBe(
        prepared.detached.rootMetadataHistory[index],
      );
    }
    for (
      let index = 0;
      index < prepared.detached.registryManifestHistory.length;
      index += 1
    ) {
      expect(closure.registryManifestHistory[index]).toBe(
        prepared.detached.registryManifestHistory[index],
      );
    }
    expect(copyLedger).toEqual({
      preparedHistorySnapshotAttemptCount: 0,
      retainedParallelHistoryGraphCount: 0,
      nestedPreparedSnapshotAttemptCount: 0,
    });
    expect(Object.isFrozen(copyLedger)).toBe(true);
    expect(registryTrustWitnessHandle).not.toBe(prepared.inputHandle);
    expect(Object.isFrozen(prepared.inputHandle)).toBe(true);
    expect(Object.isFrozen(registryTrustWitnessHandle)).toBe(true);
    expect(Reflect.ownKeys(prepared.inputHandle)).toEqual([]);
    expect(Reflect.ownKeys(registryTrustWitnessHandle)).toEqual([]);

    const impostorClosure = Object.freeze({ ...closure });
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        impostorClosure,
        registryTrustWitnessHandle,
        capability,
      ),
    ).toBeUndefined();
    const witness = takeRegistryHistoryVerifiedWitnessInternalV1(
      closure,
      registryTrustWitnessHandle,
      capability,
    );
    expect(witness).toBeDefined();
    if (witness === undefined) return;

    const tipManifest = prepared.detached.registryManifestHistory.at(-1)!;
    const tipRoot = prepared.detached.rootMetadataHistory.find(
      (candidate) =>
        candidate.rootGeneration ===
          tipManifest.payload.activeRootMetadata.rootGeneration &&
        candidate.rootKeyId ===
          tipManifest.payload.activeRootMetadata.rootKeyId &&
        candidate.contentDigest ===
          tipManifest.payload.activeRootMetadata.contentDigest,
    )!;
    const enabledTipMembers = tipManifest.payload.members.filter(
      (member) => member.disposition === "enabled",
    );
    expect(witness.suppliedHistoryTipRoot).toBe(
      tipRoot.payload.activeRoot,
    );
    expect(witness.tipManifestGenerationId).toBe(tipManifest.generationId);
    expect(witness.tipManifestContentDigest).toBe(tipManifest.contentDigest);
    expect(witness.verifiedTipEntries).toHaveLength(enabledTipMembers.length);
    for (let index = 0; index < enabledTipMembers.length; index += 1) {
      expect(witness.verifiedTipEntries[index]!.runtimeAttestation).toBe(
        enabledTipMembers[index]!.registryEntry.runtimeAttestation,
      );
      expect(
        witness.verifiedTipEntries[index]!
          .historicallyVerifiedApproverPublicKeys,
      ).toBe(
        enabledTipMembers[index]!.registryEntry.feasibilityApprovalKeys
          .publicKeyRecords,
      );
    }
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        closure,
        registryTrustWitnessHandle,
        capability,
      ),
    ).toBeUndefined();
    expect(
      discardRegistryHistoryVerifiedWitnessInternalV1(
        closure,
        registryTrustWitnessHandle,
        capability,
      ),
    ).toBe(false);

    const callsAfterSuccess = { pointCalls, signatureCalls };
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      ),
    );
    expect({ pointCalls, signatureCalls }).toEqual(callsAfterSuccess);
  });

  it("atomically consumes an exact request on wrong handle or capability", async () => {
    const wrongHandleInvocation = createPreparedInvocation();
    const wrongHandle =
      fakeOpaqueIdentity<PreparedRegistryHistoryInputHandleV1>();
    resetCryptoCalls();
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        wrongHandleInvocation.requestIdentity,
        wrongHandle,
        capability,
      ),
    );
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        wrongHandleInvocation.requestIdentity,
        wrongHandleInvocation.inputHandle,
        capability,
      ),
    );

    const wrongCapabilityInvocation = createPreparedInvocation();
    const wrongCapability =
      fakeOpaqueIdentity<ProviderStrictEd25519OpaqueCapabilityV1>();
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        wrongCapabilityInvocation.requestIdentity,
        wrongCapabilityInvocation.inputHandle,
        wrongCapability,
      ),
    );
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        wrongCapabilityInvocation.requestIdentity,
        wrongCapabilityInvocation.inputHandle,
        capability,
      ),
    );
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(0);
  });

  it("isolates same-capability concurrent invocations and their witness handles", async () => {
    const first = createPreparedInvocation();
    const second = createPreparedInvocation();
    resetCryptoCalls();
    const [firstResult, secondResult] = await Promise.all([
      diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        first.requestIdentity,
        first.inputHandle,
        capability,
      ),
      diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        second.requestIdentity,
        second.inputHandle,
        capability,
      ),
    ]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    if (!firstResult.ok || !secondResult.ok) return;
    expectHistoryCryptoCalls(2);
    expect(firstResult.value.closure).not.toBe(secondResult.value.closure);
    expect(firstResult.value.registryTrustWitnessHandle).not.toBe(
      secondResult.value.registryTrustWitnessHandle,
    );
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        firstResult.value.closure,
        secondResult.value.registryTrustWitnessHandle,
        capability,
      ),
    ).toBeUndefined();
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        secondResult.value.closure,
        secondResult.value.registryTrustWitnessHandle,
        fakeOpaqueIdentity<ProviderStrictEd25519OpaqueCapabilityV1>(),
      ),
    ).toBeUndefined();
    // An exact-key attempt consumes each entry before handle/capability checks.
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        firstResult.value.closure,
        firstResult.value.registryTrustWitnessHandle,
        capability,
      ),
    ).toBeUndefined();
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        secondResult.value.closure,
        secondResult.value.registryTrustWitnessHandle,
        capability,
      ),
    ).toBeUndefined();
  });

  it("cleans the prepared entry on Registry failure and never returns a witness handle", async () => {
    const prepared = createPreparedInvocation((draft) => {
      const manifest = draft.registryManifestHistory[0]!.payload;
      manifest.manifestSignature = `${manifest.manifestSignature.slice(0, -1)}${
        manifest.manifestSignature.endsWith("0") ? "1" : "0"
      }` as typeof manifest.manifestSignature;
    });
    resetCryptoCalls();
    const result =
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("manifest_signature");
      expect(result.reason).toBe("signature_invalid");
    }
    expect("value" in result).toBe(false);
    const callsAfterFailure = { pointCalls, signatureCalls };
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      ),
    );
    expect({ pointCalls, signatureCalls }).toEqual(callsAfterFailure);
  });

  it("keeps ordinary public Registry validation outside both private maps", async () => {
    resetCryptoCalls();
    const publicClosure = await validateProviderRegistryManifestHistoryV1({
      installationIdentityGenerationId:
        fixture.installationIdentityGenerationId,
      bootstrapTrustBundle: structuredClone(fixture.bootstrapTrustBundle),
      rootMetadataHistory: structuredClone(fixture.rootMetadataHistory),
      registryManifestHistory: structuredClone(
        fixture.registryManifestHistory,
      ),
      strictCryptoCapability: capability,
    });
    expectHistoryCryptoCalls();
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        publicClosure,
        fakeOpaqueIdentity<RegistryTrustWitnessHandleV1>(),
        capability,
      ),
    ).toBeUndefined();
  });

  it("rejects duplicate registration without deleting the original binding", () => {
    const prepared = createPreparedInvocation();
    const duplicateSnapshot = createPreparedRegistryHistorySnapshotInternalV1({
      installationIdentityGenerationId:
        prepared.detached.installationIdentityGenerationId,
      bootstrapTrustBundle: prepared.detached.bootstrapTrustBundle,
      rootMetadataHistory: prepared.detached.rootMetadataHistory,
      registryManifestHistory: prepared.detached.registryManifestHistory,
      strictCryptoCapability: capability,
    });
    expect(() =>
      registerPreparedRegistryHistoryInputInternalV1(
        prepared.requestIdentity,
        duplicateSnapshot,
        capability,
      ),
    ).toThrow(TypeError);
    expect(
      discardPreparedRegistryHistoryInputInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      ),
    ).toBe(true);
  });
});

describe("prepared Registry/Root architecture boundary", () => {
  const manifestSource = readFileSync(
    fileURLToPath(
      new URL("../src/provider-registry-manifest-history.ts", import.meta.url),
    ),
    "utf8",
  );
  const rootSource = readFileSync(
    fileURLToPath(
      new URL("../src/provider-registry-root-history.ts", import.meta.url),
    ),
    "utf8",
  );
  const handleSource = readFileSync(
    fileURLToPath(
      new URL(
        "../src/provider-registry-history-prepared-handle-internal.ts",
        import.meta.url,
      ),
    ),
    "utf8",
  );

  it("has no public prepared export and calls no public/snapshot wrapper", () => {
    expect(manifestSource).not.toMatch(
      /export\s+(?:async\s+)?function\s+diagnoseProviderRegistryManifestHistoryPreparedInternalV1/u,
    );
    expect(rootSource).not.toMatch(
      /export\s+(?:async\s+)?function\s+validateProviderRegistryRootMetadataHistoryPreparedInternalV1/u,
    );

    const manifestPreparedCore = manifestSource.slice(
      manifestSource.indexOf("async function validatePreparedInternalV1"),
      manifestSource.indexOf(
        "async function diagnoseProviderRegistryManifestHistoryPreparedInternalV1",
      ),
    );
    expect(manifestPreparedCore).not.toContain("snapshotExactInputV1(");
    expect(manifestPreparedCore).not.toContain(
      "snapshotManifestHistoryCandidatesV1(",
    );
    expect(manifestPreparedCore).not.toContain("snapshotBoundedJsonV1(");
    expect(manifestPreparedCore).not.toContain(
      "validateProviderRegistryRootMetadataHistoryV1(",
    );
    expect(manifestPreparedCore).toContain(
      "validateProviderRegistryRootMetadataHistoryPreparedInternalV1(",
    );

    const rootPreparedCore = rootSource.slice(
      rootSource.indexOf(
        "async function validateProviderRegistryRootMetadataHistoryPreparedInternalV1",
      ),
      rootSource.indexOf(
        "registerProviderRegistryRootHistoryPreparedValidatorInternalV1(",
      ),
    );
    expect(rootPreparedCore).not.toContain(
      "snapshotRootMetadataHistoryCandidatesV1(",
    );
    expect(rootPreparedCore).not.toContain(
      "snapshotBoundedEnvelopeJsonV1(",
    );
    expect(rootPreparedCore).not.toContain(
      "validateProviderRegistryRootMetadataHistoryV1(",
    );
    expect(rootPreparedCore).not.toContain(
      "diagnoseProviderRegistryRootMetadataHistoryInternalV1(",
    );
  });

  it("owns exactly the two distinct private WeakMaps required by the handoff", () => {
    expect(handleSource.match(/new CapturedWeakMapV1</gu)).toHaveLength(2);
    expect(handleSource).toContain("preparedRegistryHistorySnapshotsV1");
    expect(handleSource).toContain("registryHistoryVerifiedWitnessesV1");
  });
});
