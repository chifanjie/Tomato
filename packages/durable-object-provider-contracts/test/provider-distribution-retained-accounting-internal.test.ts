import { describe, expect, it } from "vitest";

import * as publicApi from "../src/index.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import {
  PROVIDER_DISTRIBUTION_MAX_SINGLE_RETAINED_OBJECT_CANONICAL_BYTES_V1,
  PROVIDER_DISTRIBUTION_MAX_TOTAL_RETAINED_HISTORY_LOGICAL_BYTES_V1,
  PROVIDER_DISTRIBUTION_MAX_TOTAL_RETAINED_OBJECT_COUNT_V1,
  ProviderDistributionRetainedAccountingErrorInternalV1,
  createProviderDistributionRetainedAccountingAccumulatorInternalV1,
  diagnoseProviderDistributionRetainedLimitTransitionInternalV1,
  diagnoseProviderDistributionRetainedNormalCandidateInternalV1,
  isProviderDistributionRetainedAccountingErrorInternalV1,
  type ProviderDistributionRetainedAccountingFailureReasonInternalV1,
} from "../src/provider-distribution-retained-accounting-internal.js";
import { PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1 } from "../src/provider-trust-policy.js";

const digestV1 = (byte: string): string => `sha256:${byte.repeat(32)}`;

function bindingV1(release = "11"): object {
  return {
    profile: "provider_signed_distribution_root_binding_v1",
    releaseRevisionDigest: digestV1(release),
  };
}

function locatorV1(generation = 1): object {
  return {
    locatorProfile: "distribution_provider_public_support_taxonomy_v1",
    taxonomyGeneration: generation,
  };
}

function envelopeV1(contentDigest = digestV1("22"), marker = "alpha"): object {
  return {
    schemaVersion: 1,
    recordType: "provider_public_support_taxonomy",
    taxonomyGeneration: 1,
    contentDigest,
    payload: { marker },
  };
}

function expectAccountingReasonV1(
  operation: () => unknown,
  reason: ProviderDistributionRetainedAccountingFailureReasonInternalV1,
): void {
  try {
    operation();
  } catch (error) {
    expect(
      isProviderDistributionRetainedAccountingErrorInternalV1(error),
    ).toBe(true);
    expect(
      (error as ProviderDistributionRetainedAccountingErrorInternalV1).reason,
    ).toBe(reason);
    return;
  }
  throw new TypeError(`expected retained accounting failure: ${reason}`);
}

describe("provider distribution retained accounting internal", () => {
  it("charges one full canonical Envelope and exact-dedupes its typed key", () => {
    const accumulator =
      createProviderDistributionRetainedAccountingAccumulatorInternalV1();
    const distributionRootBinding = bindingV1();
    const locator = locatorV1();
    const contentDigest = digestV1("22");
    const envelope = envelopeV1(contentDigest);
    const expectedBytes =
      canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength;

    const first = accumulator.admitEnvelope({
      distributionRootBinding,
      locator,
      contentDigest,
      envelope,
    });

    expect(first.outcome).toBe("admitted");
    expect(first.objectKind).toBe("envelope");
    expect(first.canonicalObjectBytes).toBe(expectedBytes);
    expect(first.incrementalRetainedHistoryLogicalBytes).toBe(expectedBytes);
    expect(first.fullObjectFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(first.snapshot).toEqual({
      retainedObjectCount: 1,
      retainedEnvelopeCount: 1,
      retainedEmbeddedBundleCount: 0,
      retainedHistoryLogicalBytes: expectedBytes,
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.snapshot)).toBe(true);

    const duplicate = accumulator.admitEnvelope({
      distributionRootBinding: {
        releaseRevisionDigest: digestV1("11"),
        profile: "provider_signed_distribution_root_binding_v1",
      },
      locator: {
        taxonomyGeneration: 1,
        locatorProfile:
          "distribution_provider_public_support_taxonomy_v1",
      },
      contentDigest,
      envelope: {
        payload: { marker: "alpha" },
        contentDigest,
        taxonomyGeneration: 1,
        recordType: "provider_public_support_taxonomy",
        schemaVersion: 1,
      },
    });

    expect(duplicate.outcome).toBe("duplicate");
    expect(duplicate.fullObjectFingerprint).toBe(
      first.fullObjectFingerprint,
    );
    expect(duplicate.incrementalRetainedHistoryLogicalBytes).toBe(0);
    expect(duplicate.snapshot).toEqual(first.snapshot);
    expect(accumulator.snapshot()).toEqual(first.snapshot);
  });

  it("rejects locator ownership conflicts without changing committed usage", () => {
    const accumulator =
      createProviderDistributionRetainedAccountingAccumulatorInternalV1();
    const contentDigest = digestV1("22");
    accumulator.admitEnvelope({
      distributionRootBinding: bindingV1(),
      locator: locatorV1(),
      contentDigest,
      envelope: envelopeV1(contentDigest),
    });
    const before = accumulator.snapshot();

    expectAccountingReasonV1(
      () =>
        accumulator.admitEnvelope({
          distributionRootBinding: bindingV1(),
          locator: locatorV1(),
          contentDigest,
          envelope: envelopeV1(contentDigest, "different-full-envelope"),
        }),
      "locator_ownership_conflict",
    );
    expect(accumulator.snapshot()).toEqual(before);

    expectAccountingReasonV1(
      () =>
        accumulator.admitEnvelope({
          distributionRootBinding: bindingV1(),
          locator: locatorV1(),
          contentDigest: digestV1("33"),
          envelope: envelopeV1(digestV1("33")),
        }),
      "locator_ownership_conflict",
    );
    expect(accumulator.snapshot()).toEqual(before);

    const otherBinding = accumulator.admitEnvelope({
      distributionRootBinding: bindingV1("44"),
      locator: locatorV1(),
      contentDigest,
      envelope: envelopeV1(contentDigest),
    });
    expect(otherBinding.outcome).toBe("admitted");
    expect(otherBinding.snapshot.retainedObjectCount).toBe(2);
  });

  it("counts an embedded Bundle per parent, charges zero logical bytes, and exact-dedupes", () => {
    const accumulator =
      createProviderDistributionRetainedAccountingAccumulatorInternalV1();
    const bundle = {
      profile: "provider_target_discovery_input_bundle_v1",
      observations: [{ sourceRecordOrdinal: 0 }],
    };
    const input = {
      distributionRootBinding: bindingV1(),
      parentDiscoveryContentDigest: digestV1("55"),
      bundleContentDigest: digestV1("66"),
      bundle,
    };

    const first = accumulator.admitEmbeddedTargetDiscoveryInputBundle(input);
    expect(first.outcome).toBe("admitted");
    expect(first.objectKind).toBe(
      "embedded_target_discovery_input_bundle",
    );
    expect(first.canonicalObjectBytes).toBe(
      canonicalizeJcsSafeIntegerUtf8V1(bundle).byteLength,
    );
    expect(first.incrementalRetainedHistoryLogicalBytes).toBe(0);
    expect(first.snapshot).toEqual({
      retainedObjectCount: 1,
      retainedEnvelopeCount: 0,
      retainedEmbeddedBundleCount: 1,
      retainedHistoryLogicalBytes: 0,
    });

    expect(
      accumulator.admitEmbeddedTargetDiscoveryInputBundle(input).outcome,
    ).toBe("duplicate");
    expect(accumulator.snapshot().retainedObjectCount).toBe(1);

    const secondParent =
      accumulator.admitEmbeddedTargetDiscoveryInputBundle({
        ...input,
        parentDiscoveryContentDigest: digestV1("77"),
      });
    expect(secondParent.outcome).toBe("admitted");
    expect(secondParent.snapshot.retainedObjectCount).toBe(2);
    expect(secondParent.snapshot.retainedHistoryLogicalBytes).toBe(0);

    const before = accumulator.snapshot();
    expectAccountingReasonV1(
      () =>
        accumulator.admitEmbeddedTargetDiscoveryInputBundle({
          ...input,
          bundle: { ...bundle, observations: [] },
        }),
      "retained_object_key_conflict",
    );
    expect(accumulator.snapshot()).toEqual(before);
  });

  it("freezes the single-object, object-count, and logical-byte transitions", () => {
    const singleCap =
      PROVIDER_DISTRIBUTION_MAX_SINGLE_RETAINED_OBJECT_CANONICAL_BYTES_V1;
    const objectCap =
      PROVIDER_DISTRIBUTION_MAX_TOTAL_RETAINED_OBJECT_COUNT_V1;
    const byteCap =
      PROVIDER_DISTRIBUTION_MAX_TOTAL_RETAINED_HISTORY_LOGICAL_BYTES_V1;

    expect(
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: 0,
        currentRetainedHistoryLogicalBytes: 0,
        nextObjectKind: "envelope",
        nextCanonicalObjectBytes: singleCap,
      }),
    ).toBeUndefined();
    expect(
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: 0,
        currentRetainedHistoryLogicalBytes: 0,
        nextObjectKind: "envelope",
        nextCanonicalObjectBytes: singleCap + 1,
      }),
    ).toBe("single_object_byte_limit_exceeded");

    expect(
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: objectCap - 1,
        currentRetainedHistoryLogicalBytes: 0,
        nextObjectKind: "embedded_target_discovery_input_bundle",
        nextCanonicalObjectBytes: 1,
      }),
    ).toBeUndefined();
    expect(
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: objectCap,
        currentRetainedHistoryLogicalBytes: 0,
        nextObjectKind: "embedded_target_discovery_input_bundle",
        nextCanonicalObjectBytes: 1,
      }),
    ).toBe("retained_object_count_limit_exceeded");

    expect(
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: 0,
        currentRetainedHistoryLogicalBytes: byteCap - 1,
        nextObjectKind: "envelope",
        nextCanonicalObjectBytes: 1,
      }),
    ).toBeUndefined();
    expect(
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: 0,
        currentRetainedHistoryLogicalBytes: byteCap - 1,
        nextObjectKind: "envelope",
        nextCanonicalObjectBytes: 2,
      }),
    ).toBe("retained_history_byte_limit_exceeded");
    expect(
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: 0,
        currentRetainedHistoryLogicalBytes: byteCap,
        nextObjectKind: "embedded_target_discovery_input_bundle",
        nextCanonicalObjectBytes: 1,
      }),
    ).toBeUndefined();
  });

  it("preserves the normal-candidate eight-generation and 16 MiB emergency reserves", () => {
    const policy = PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1;
    const normalGenerationLimit =
      policy.maxSupportCatalogGenerationCount -
      policy.normalUpdateEmergencyGenerationReservePerChain;
    const normalLogicalByteLimit =
      policy.maxTotalRetainedDistributionHistoryLogicalBytes -
      policy.normalUpdateEmergencyLogicalBytesReserve;
    const candidate = {
      supportCatalogGenerationCount: normalGenerationLimit,
      publicTaxonomyGenerationCount: normalGenerationLimit,
      releaseMatrixGenerationCount: normalGenerationLimit,
      targetDiscoveryResultGenerationCount: normalGenerationLimit,
      releaseTargetUniverseGenerationCount: normalGenerationLimit,
      retainedHistoryLogicalBytes: normalLogicalByteLimit,
    };

    expect(
      diagnoseProviderDistributionRetainedNormalCandidateInternalV1(
        candidate,
      ),
    ).toBeUndefined();
    expect(
      diagnoseProviderDistributionRetainedNormalCandidateInternalV1({
        ...candidate,
        targetDiscoveryResultGenerationCount: normalGenerationLimit + 1,
      }),
    ).toBe("normal_update_emergency_generation_reserve_exhausted");
    expect(
      diagnoseProviderDistributionRetainedNormalCandidateInternalV1({
        ...candidate,
        retainedHistoryLogicalBytes: normalLogicalByteLimit + 1,
      }),
    ).toBe("normal_update_emergency_logical_bytes_reserve_exhausted");
  });

  it("rejects unsafe counters and unsafe JSON numbers before mutating usage", () => {
    expect(
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: Number.MAX_SAFE_INTEGER + 1,
        currentRetainedHistoryLogicalBytes: 0,
        nextObjectKind: "envelope",
        nextCanonicalObjectBytes: 1,
      }),
    ).toBe("invalid_safe_integer");
    expect(
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: 0,
        currentRetainedHistoryLogicalBytes: -1,
        nextObjectKind: "envelope",
        nextCanonicalObjectBytes: 1,
      }),
    ).toBe("invalid_safe_integer");
    expect(
      diagnoseProviderDistributionRetainedLimitTransitionInternalV1({
        currentRetainedObjectCount: 0,
        currentRetainedHistoryLogicalBytes: 0,
        nextObjectKind: "forged" as "envelope",
        nextCanonicalObjectBytes: 1,
      }),
    ).toBe("object_invalid");

    const accumulator =
      createProviderDistributionRetainedAccountingAccumulatorInternalV1();
    expectAccountingReasonV1(
      () =>
        accumulator.admitEnvelope({
          distributionRootBinding: bindingV1(),
          locator: locatorV1(),
          contentDigest: digestV1("22"),
          envelope: {
            ...envelopeV1(),
            unsafe: Number.MAX_SAFE_INTEGER + 1,
          },
        }),
      "object_invalid",
    );
    expect(accumulator.snapshot()).toEqual({
      retainedObjectCount: 0,
      retainedEnvelopeCount: 0,
      retainedEmbeddedBundleCount: 0,
      retainedHistoryLogicalBytes: 0,
    });
  });

  it("brands accounting failures without consulting poisoned hasInstance hooks", () => {
    const original = Object.getOwnPropertyDescriptor(
      TypeError,
      Symbol.hasInstance,
    );
    Object.defineProperty(TypeError, Symbol.hasInstance, {
      configurable: true,
      value() {
        throw new TypeError("attacker-owned hasInstance executed");
      },
    });
    try {
      expectAccountingReasonV1(
        () =>
          createProviderDistributionRetainedAccountingAccumulatorInternalV1()
            .admitEnvelope({
              distributionRootBinding: bindingV1(),
              locator: locatorV1(),
              contentDigest: digestV1("22"),
              envelope: {
                ...envelopeV1(),
                unsafe: Number.MAX_SAFE_INTEGER + 1,
              },
            }),
        "object_invalid",
      );
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(TypeError, Symbol.hasInstance);
      } else {
        Object.defineProperty(TypeError, Symbol.hasInstance, original);
      }
    }
  });

  it("does not late-bind Number.toString or String.padStart while fingerprinting", () => {
    const accumulator =
      createProviderDistributionRetainedAccountingAccumulatorInternalV1();
    const contentDigest = digestV1("22");
    const input = {
      distributionRootBinding: bindingV1(),
      locator: locatorV1(),
      contentDigest,
      envelope: envelopeV1(contentDigest),
    };
    const numberToString = Object.getOwnPropertyDescriptor(
      Number.prototype,
      "toString",
    );
    const stringPadStart = Object.getOwnPropertyDescriptor(
      String.prototype,
      "padStart",
    );
    let result: ReturnType<typeof accumulator.admitEnvelope> | undefined;
    try {
      Object.defineProperty(Number.prototype, "toString", {
        configurable: true,
        value() {
          throw new TypeError("poisoned Number.prototype.toString");
        },
        writable: true,
      });
      Object.defineProperty(String.prototype, "padStart", {
        configurable: true,
        value() {
          throw new TypeError("poisoned String.prototype.padStart");
        },
        writable: true,
      });
      result = accumulator.admitEnvelope(input);
    } finally {
      if (numberToString !== undefined) {
        Object.defineProperty(Number.prototype, "toString", numberToString);
      }
      if (stringPadStart !== undefined) {
        Object.defineProperty(String.prototype, "padStart", stringPadStart);
      }
    }
    expect(result?.outcome).toBe("admitted");
    expect(result?.fullObjectFingerprint).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
  });

  it("does not late-bind TypedArray byteLength while charging or fingerprinting", () => {
    const accumulator =
      createProviderDistributionRetainedAccountingAccumulatorInternalV1();
    const contentDigest = digestV1("22");
    const envelope = envelopeV1(contentDigest);
    const expectedBytes =
      canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength;
    const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
    const byteLengthDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "byteLength",
    );
    if (byteLengthDescriptor === undefined) {
      throw new TypeError("TypedArray byteLength descriptor is unavailable");
    }

    let first:
      | ReturnType<typeof accumulator.admitEnvelope>
      | undefined;
    let conflict: unknown;
    try {
      Object.defineProperty(typedArrayPrototype, "byteLength", {
        configurable: true,
        get() {
          return 0;
        },
      });
      first = accumulator.admitEnvelope({
        distributionRootBinding: bindingV1(),
        locator: locatorV1(),
        contentDigest,
        envelope,
      });
      try {
        accumulator.admitEnvelope({
          distributionRootBinding: bindingV1(),
          locator: locatorV1(),
          contentDigest,
          envelope: envelopeV1(contentDigest, "different-full-envelope"),
        });
      } catch (error) {
        conflict = error;
      }
    } finally {
      Object.defineProperty(
        typedArrayPrototype,
        "byteLength",
        byteLengthDescriptor,
      );
    }

    expect(first?.canonicalObjectBytes).toBe(expectedBytes);
    expect(first?.incrementalRetainedHistoryLogicalBytes).toBe(expectedBytes);
    expect(first?.fullObjectFingerprint).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
    expect(
      isProviderDistributionRetainedAccountingErrorInternalV1(conflict),
    ).toBe(true);
    expect(
      (conflict as ProviderDistributionRetainedAccountingErrorInternalV1)
        .reason,
    ).toBe("locator_ownership_conflict");
    expect(accumulator.snapshot()).toEqual({
      retainedObjectCount: 1,
      retainedEnvelopeCount: 1,
      retainedEmbeddedBundleCount: 0,
      retainedHistoryLogicalBytes: expectedBytes,
    });
  });

  it("does not expose the package-private accumulator from the public barrel", () => {
    expect(
      Object.hasOwn(
        publicApi,
        "createProviderDistributionRetainedAccountingAccumulatorInternalV1",
      ),
    ).toBe(false);
  });
});
