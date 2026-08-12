import { describe, expect, it, vi } from "vitest";

import {
  ContentDigestV1Schema,
  ProviderFilesystemProfileCodeV1Schema,
  ProviderOsReleaseFamilyCodeV1Schema,
} from "../src/primitives.js";
import {
  deriveProviderTargetProfileIdV1,
  type ProviderFeasibilityTargetV1,
} from "../src/provider-target-discovery-point.js";
import {
  consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1,
  mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1,
  type ProviderOpenedRootPhysicalTargetObservationResultInternalV1,
  type ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1,
} from "../src/provider-trusted-local-physical-target-observation-capability-internal.js";

function digestV1(byte: string) {
  return ContentDigestV1Schema.parse(`sha256:${byte.repeat(64)}`);
}

function targetV1(
  overrides: Partial<Omit<ProviderFeasibilityTargetV1, "targetProfileId">> = {},
): ProviderFeasibilityTargetV1 {
  const fields = {
    osPlatform: "darwin" as const,
    osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1Schema.parse(
      "provider-os-family:0123456789abcdef012345",
    ),
    osBuildDigest: digestV1("1"),
    architecture: "arm64" as const,
    filesystemProfileCode: ProviderFilesystemProfileCodeV1Schema.parse(
      "provider-fs-profile:0123456789abcdef012345",
    ),
    filesystemFeatureProfileDigest: digestV1("2"),
    mountOptionProfileDigest: digestV1("3"),
    ...overrides,
  };
  return {
    targetProfileId: deriveProviderTargetProfileIdV1(fields),
    ...fields,
  };
}

function observationV1(
  target = targetV1(),
  witness: Uint8Array = new Uint8Array([0x39, 0x01]),
): ProviderOpenedRootPhysicalTargetObservationResultInternalV1 {
  return { target, rootVolumeContinuityWitness: witness };
}

async function mintV1(
  observations: unknown[],
  openedRootAuthority = Object.freeze({ root: true }),
) {
  const observe = vi.fn((receivedAuthority: object) => {
    expect(receivedAuthority).toBe(openedRootAuthority);
    const value = observations.shift();
    if (value instanceof Error) throw value;
    return value;
  });
  const capability =
    await mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
      {
        openedRootAuthority,
        physicalTargetObservationHost: Object.freeze({
          observeOpenedRootPhysicalTargetV1: observe,
        }),
      },
    );
  return { capability, observe };
}

function expectObservationErrorV1(
  error: unknown,
  stage: ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1["stage"],
  reason: ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1["reason"],
): void {
  expect(error).toMatchObject({
    name: "ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1",
    message: "trusted local physical-target observation failed",
    stage,
    reason,
  });
  expect(Object.isFrozen(error)).toBe(true);
}

describe("D-39 trusted local physical-target observation capability internal", () => {
  it.each([
    [
      "mint input extra key",
      {
        openedRootAuthority: Object.freeze({}),
        physicalTargetObservationHost: Object.freeze({
          observeOpenedRootPhysicalTargetV1: () => observationV1(),
        }),
        extra: true,
      },
    ],
    [
      "observation host extra key",
      {
        openedRootAuthority: Object.freeze({}),
        physicalTargetObservationHost: Object.freeze({
          observeOpenedRootPhysicalTargetV1: () => observationV1(),
          extra: true,
        }),
      },
    ],
  ])("rejects an inexact %s", async (_label, input) => {
    await expect(
      mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
        input as any,
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectObservationErrorV1(
        error,
        "physical_target_observation_capability",
        "capability_invalid",
      );
      return true;
    });
  });

  it("mints a frozen null-prototype zero-key shell and releases only after matching baseline/pre/post", async () => {
    const sourceWitness = new Uint8Array([0x39, 0x01]);
    const sourceTarget = targetV1();
    const { capability, observe } = await mintV1([
      observationV1(sourceTarget, sourceWitness),
      observationV1(targetV1(), new Uint8Array([0x39, 0x01])),
      observationV1(targetV1(), new Uint8Array([0x39, 0x01])),
    ]);
    sourceWitness[0] = 0xff;
    sourceTarget.osBuildDigest = digestV1("f");

    expect(Object.getPrototypeOf(capability)).toBeNull();
    expect(Object.isFrozen(capability)).toBe(true);
    expect(Reflect.ownKeys(capability)).toEqual([]);

    let callbackWitnessMutation = false;
    const result =
      await consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
        capability,
        (pair) => {
          expect(Object.getPrototypeOf(pair)).toBeNull();
          expect(Object.isFrozen(pair)).toBe(true);
          expect(pair.baseline.target.osBuildDigest).toBe(digestV1("1"));
          expect(pair.pre.target).toEqual(pair.baseline.target);
          pair.baseline.rootVolumeContinuityWitness[0] = 0x00;
          callbackWitnessMutation = true;
          return Object.freeze({ selected: true });
        },
      );

    expect(callbackWitnessMutation).toBe(true);
    expect(observe).toHaveBeenCalledTimes(3);
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.observedTarget.osBuildDigest).toBe(digestV1("1"));
    expect(result.result).toEqual({ selected: true });
  });

  it("burns before callback validation and admits at most one concurrent consumer", async () => {
    let releasePre!: () => void;
    const preGate = new Promise<void>((resolve) => {
      releasePre = resolve;
    });
    const stable = observationV1();
    let call = 0;
    const capability =
      await mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
        {
          openedRootAuthority: Object.freeze({}),
          physicalTargetObservationHost: Object.freeze({
            observeOpenedRootPhysicalTargetV1: async () => {
              call += 1;
              if (call === 2) await preGate;
              return observationV1(stable.target, new Uint8Array([0x39]));
            },
          }),
        },
      );

    const first =
      consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
        capability,
        () => "winner",
      );
    const second =
      consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
        capability,
        () => "loser",
      );
    await expect(second).rejects.toSatisfy((error: unknown) => {
      expectObservationErrorV1(
        error,
        "physical_target_observation_capability",
        "capability_invalid",
      );
      return true;
    });
    releasePre();
    await expect(first).resolves.toMatchObject({ result: "winner" });

    const malformedCallbackCapability = (
      await mintV1([
        observationV1(),
        observationV1(),
        observationV1(),
      ])
    ).capability;
    await expect(
      consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
        malformedCallbackCapability,
        undefined as never,
      ),
    ).rejects.toMatchObject({ reason: "capability_invalid" });
    await expect(
      consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
        malformedCallbackCapability,
        () => "cannot revive",
      ),
    ).rejects.toMatchObject({ reason: "capability_invalid" });
  });

  it("preserves callback error identity and does not run the postcheck", async () => {
    const marker = new Error("selector diagnostic identity");
    const { capability, observe } = await mintV1([
      observationV1(),
      observationV1(),
      observationV1(),
    ]);
    await expect(
      consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
        capability,
        () => {
          throw marker;
        },
      ),
    ).rejects.toBe(marker);
    expect(observe).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      "pre witness",
      [observationV1(), observationV1(targetV1(), new Uint8Array([0x40]))],
      "physical_target_precheck",
      "root_volume_changed",
    ],
    [
      "post target",
      [
        observationV1(),
        observationV1(),
        observationV1(targetV1({ osBuildDigest: digestV1("e") })),
      ],
      "physical_target_postcheck",
      "observation_changed",
    ],
    [
      "simultaneous post witness and target",
      [
        observationV1(),
        observationV1(),
        observationV1(
          targetV1({ osBuildDigest: digestV1("d") }),
          new Uint8Array([0x41]),
        ),
      ],
      "physical_target_postcheck",
      "root_volume_changed",
    ],
  ] as const)(
    "rejects %s drift with witness-first precedence",
    async (_label, source, stage, reason) => {
      const observations = [...source];
      const { capability } = await mintV1(observations);
      await expect(
        consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
          capability,
          () => true,
        ),
      ).rejects.toSatisfy((error: unknown) => {
        expectObservationErrorV1(error, stage, reason);
        return true;
      });
    },
  );

  it.each([
    ["zero-byte witness", observationV1(targetV1(), new Uint8Array(0))],
    ["4097-byte witness", observationV1(targetV1(), new Uint8Array(4097))],
    [
      "wrong target profile ID",
      {
        ...observationV1(),
        target: {
          ...targetV1(),
          targetProfileId: `provider-target-profile:${"f".repeat(64)}`,
        },
      },
    ],
    ["extra observation field", { ...observationV1(), extra: true }],
  ])("rejects an invalid baseline: %s", async (_label, invalid) => {
    await expect(mintV1([invalid])).rejects.toSatisfy((error: unknown) => {
      expectObservationErrorV1(
        error,
        "physical_target_baseline",
        "observation_invalid",
      );
      return true;
    });
  });

  it("uses captured WeakMap, typed-array and Promise primordials after import", async () => {
    const weakMapHasDescriptor = Object.getOwnPropertyDescriptor(
      WeakMap.prototype,
      "has",
    )!;
    const weakMapGetDescriptor = Object.getOwnPropertyDescriptor(
      WeakMap.prototype,
      "get",
    )!;
    const weakMapSetDescriptor = Object.getOwnPropertyDescriptor(
      WeakMap.prototype,
      "set",
    )!;
    const weakMapDeleteDescriptor = Object.getOwnPropertyDescriptor(
      WeakMap.prototype,
      "delete",
    )!;
    const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
    const byteLengthDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "byteLength",
    )!;
    const promiseResolveDescriptor = Object.getOwnPropertyDescriptor(
      Promise,
      "resolve",
    )!;
    const poison = vi.fn(() => {
      throw new TypeError("late-bound primordial");
    });

    const stableObservations = [
      observationV1(),
      observationV1(),
      observationV1(),
    ];
    const openedRootAuthority = Object.freeze({});
    const stableHost = Object.freeze({
      observeOpenedRootPhysicalTargetV1: () => stableObservations.shift(),
    });
    let result: unknown;
    try {
      Object.defineProperty(WeakMap.prototype, "has", {
        ...weakMapHasDescriptor,
        value: poison,
      });
      Object.defineProperty(WeakMap.prototype, "get", {
        ...weakMapGetDescriptor,
        value: poison,
      });
      Object.defineProperty(WeakMap.prototype, "set", {
        ...weakMapSetDescriptor,
        value: poison,
      });
      Object.defineProperty(WeakMap.prototype, "delete", {
        ...weakMapDeleteDescriptor,
        value: poison,
      });
      Object.defineProperty(typedArrayPrototype, "byteLength", {
        ...byteLengthDescriptor,
        get: poison,
      });
      Object.defineProperty(Promise, "resolve", {
        ...promiseResolveDescriptor,
        value: poison,
      });

      const capability =
        await mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
          {
            openedRootAuthority,
            physicalTargetObservationHost: stableHost,
          },
        );
      result =
        await consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
          capability,
          () => "stable",
        );
    } finally {
      Object.defineProperty(WeakMap.prototype, "has", weakMapHasDescriptor);
      Object.defineProperty(WeakMap.prototype, "get", weakMapGetDescriptor);
      Object.defineProperty(WeakMap.prototype, "set", weakMapSetDescriptor);
      Object.defineProperty(
        WeakMap.prototype,
        "delete",
        weakMapDeleteDescriptor,
      );
      Object.defineProperty(
        typedArrayPrototype,
        "byteLength",
        byteLengthDescriptor,
      );
      Object.defineProperty(Promise, "resolve", promiseResolveDescriptor);
    }
    expect(result).toMatchObject({ result: "stable" });
    expect(poison).not.toHaveBeenCalled();
  });
});
