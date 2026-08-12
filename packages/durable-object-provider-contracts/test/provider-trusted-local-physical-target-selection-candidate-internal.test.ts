import { describe, expect, it } from "vitest";

import {
  deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1,
  ProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1,
} from "../src/provider-trusted-local-physical-target-selection-candidate-internal.js";

const target = Object.freeze({
  targetProfileId: `provider-target-profile:${"1".repeat(64)}`,
  osPlatform: "linux",
  osReleaseFamilyCode: `provider-os-family:${"2".repeat(22)}`,
  osBuildDigest: `sha256:${"3".repeat(64)}`,
  architecture: "x86_64",
  filesystemProfileCode: `provider-fs-profile:${"4".repeat(22)}`,
  filesystemFeatureProfileDigest: `sha256:${"5".repeat(64)}`,
  mountOptionProfileDigest: `sha256:${"6".repeat(64)}`,
});
const pin = Object.freeze({
  locatorProfile: "distribution_provider_feasibility_support_catalog_v1",
  catalogGeneration: 1,
  contentDigest: `sha256:${"7".repeat(64)}`,
});

function validationV1(overrides: Record<string, unknown> = {}) {
  return {
    releaseTargetUniverseTip: {
      payload: { targets: [{ target }] },
    },
    providerFeasibilitySupportCatalogTip: {
      catalogGeneration: 1,
      contentDigest: pin.contentDigest,
      payload: { targets: [{ target, candidates: [{}] }] },
    },
    currentCatalogProjection: {
      ownerTargetCapabilities: [{ target, capability: "strong_read_write" }],
      providerFeasibilitySupportCatalogPin: pin,
    },
    catalogPointClosure: {
      providerFeasibilitySupportCatalogPin: pin,
    },
    ...overrides,
  } as any;
}

describe("trusted local physical-target private selection seam", () => {
  it("preserves a truthful read-only owner capability without selecting a writer", () => {
    const validation = validationV1();
    validation.currentCatalogProjection.ownerTargetCapabilities = [
      { target, capability: "legacy_redacted_read_only" },
    ];
    expect(
      deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1(
        validation,
        target as any,
      ),
    ).toEqual({
      selectedOwnerTargetCapability: {
        target,
        capability: "legacy_redacted_read_only",
      },
      providerFeasibilitySupportCatalogPin: pin,
    });
  });

  it("classifies a duplicate full-target match as ambiguous", () => {
    const validation = validationV1();
    validation.releaseTargetUniverseTip.payload.targets.push({ target });
    expect(() =>
      deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1(
        validation,
        target as any,
      )
    ).toThrowError(
      expect.objectContaining({
        name: "ProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1",
        reason: "target_ambiguous_match",
      }),
    );
  });

  it("rejects projection Pin drift after all three target joins", () => {
    const validation = validationV1();
    validation.catalogPointClosure.providerFeasibilitySupportCatalogPin = {
      ...pin,
      contentDigest: `sha256:${"8".repeat(64)}`,
    };
    expect(() =>
      deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1(
        validation,
        target as any,
      )
    ).toThrowError(
      expect.objectContaining({
        name: "ProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1",
        reason: "target_projection_mismatch",
      }),
    );
  });

  it("folds malformed validated-closure state into source_invalid", () => {
    expect(() =>
      deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1(
        validationV1({ releaseTargetUniverseTip: null }),
        target as any,
      )
    ).toThrowError(
      new ProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1(
        "source_invalid",
      ),
    );
  });

  it("rejects a mismatched target after late global TextEncoder poisoning", () => {
    const originalTextEncoder = globalThis.TextEncoder;
    const mismatchedTarget = {
      ...target,
      osBuildDigest: `sha256:${"9".repeat(64)}`,
      targetProfileId: `provider-target-profile:${"a".repeat(64)}`,
    };
    class PoisonedTextEncoder {
      encode(): Uint8Array {
        return new Uint8Array(0);
      }
    }
    try {
      Object.defineProperty(globalThis, "TextEncoder", {
        configurable: true,
        writable: true,
        value: PoisonedTextEncoder,
      });
      expect(() =>
        deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1(
          validationV1(),
          mismatchedTarget as any,
        )
      ).toThrowError(
        expect.objectContaining({
          name: "ProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1",
          reason: "target_zero_match",
        }),
      );
    } finally {
      Object.defineProperty(globalThis, "TextEncoder", {
        configurable: true,
        writable: true,
        value: originalTextEncoder,
      });
    }
  });
});
