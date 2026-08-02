import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ProviderBootstrapTrustBundleEnvelopeV1Schema,
  ProviderBootstrapTrustStructureError,
} from "../src/bootstrap-trust-bundle.js";
import {
  InstallationIdentityBootstrapTrustFieldsV1Schema,
  classifyInstallationBootstrapTrustUseStructureV1,
  validateInstallationIdentityRetainedTrustStructureV1,
} from "../src/installation-bootstrap-trust.js";
import { ContentDigestV1Schema } from "../src/primitives.js";
import {
  ProviderBootstrapTrustBundlePinV1Schema,
  ProviderSignedDistributionRootBindingV1Schema,
  deriveProviderSignedPackageIdentityDigestV1,
  type ProviderBootstrapTrustBundlePinV1,
  type ProviderSignedDistributionRootBindingV1,
} from "../src/provider-distribution-trust.js";
import {
  PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1,
} from "../src/provider-trust-policy.js";
import {
  ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";

const bundleResourcePath = fileURLToPath(
  new URL(
    "../provider/bootstrap-trust-bundle-v1.json",
    import.meta.url,
  ),
);
const manifestResourcePath = fileURLToPath(
  new URL(
    "../provider/ed25519-strict-host-conformance-v1.json",
    import.meta.url,
  ),
);
const bundleResourceBytes = new Uint8Array(
  readFileSync(bundleResourcePath),
);
const manifestResourceBytes = new Uint8Array(
  readFileSync(manifestResourcePath),
);
const bundleEnvelope =
  ProviderBootstrapTrustBundleEnvelopeV1Schema.parse(
    JSON.parse(new TextDecoder().decode(bundleResourceBytes)),
  );
const manifestEnvelope =
  ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema.parse(
    JSON.parse(new TextDecoder().decode(manifestResourceBytes)),
  );

const strictHost: ProviderStrictEd25519CryptoHostV1 = Object.freeze({
  verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
});

const ORIGINAL_RELEASE_REVISION_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"42".repeat(32)}`,
);
const REPLACEMENT_BUNDLE_CONTENT_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"ab".repeat(32)}`,
);
const REPLACEMENT_RELEASE_REVISION_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"24".repeat(32)}`,
);

let strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function bundlePin(
  contentDigest: string = bundleEnvelope.contentDigest,
): ProviderBootstrapTrustBundlePinV1 {
  return ProviderBootstrapTrustBundlePinV1Schema.parse({
    locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
    contentDigest,
  });
}

function signedDistributionBinding(
  bootstrapTrustBundle: ProviderBootstrapTrustBundlePinV1,
  releaseRevisionDigest: string = ORIGINAL_RELEASE_REVISION_DIGEST,
): ProviderSignedDistributionRootBindingV1 {
  const fields = {
    resolverProfile:
      "verified_signed_package_distribution_root_v1" as const,
    releaseRevisionDigest,
    bootstrapTrustBundle,
    historyPolicy: PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1,
  };
  return ProviderSignedDistributionRootBindingV1Schema.parse({
    profile: "provider_signed_distribution_root_binding_v1",
    ...fields,
    signedPackageIdentityDigest:
      deriveProviderSignedPackageIdentityDigestV1(fields),
  });
}

function retainedTrustFields() {
  const bootstrapTrustBundle = bundlePin();
  return {
    bootstrapOriginDistributionRootBinding:
      signedDistributionBinding(bootstrapTrustBundle),
    bootstrapTrustBundle,
    bootstrapTrustBundleEnvelope: cloneJson(bundleEnvelope),
    strictEd25519AdversarialManifestEnvelope:
      cloneJson(manifestEnvelope),
  };
}

function currentBindingFor(
  bootstrapTrustBundle: ProviderBootstrapTrustBundlePinV1,
): ProviderSignedDistributionRootBindingV1 {
  return signedDistributionBinding(
    bootstrapTrustBundle,
    REPLACEMENT_RELEASE_REVISION_DIGEST,
  );
}

async function expectAttestationInvalid(
  operation: Promise<unknown>,
): Promise<void> {
  try {
    await operation;
    throw new Error("trust validation unexpectedly succeeded");
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderBootstrapTrustStructureError);
    expect(error).toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    expect(String(error)).not.toMatch(
      /provider\/|base64url:|signature|secret-canary/u,
    );
  }
}

beforeAll(async () => {
  strictCryptoCapability =
    await attestProviderStrictEd25519CryptoHostV1({
      host: strictHost,
      resourceHost: {
        readFixedSignedPackageResource: () =>
          manifestResourceBytes.slice(),
      },
    });
});

describe("Installation Identity retained bootstrap trust", () => {
  it("projects exactly the four frozen Installation Identity fields", () => {
    const parsed =
      InstallationIdentityBootstrapTrustFieldsV1Schema.parse(
        retainedTrustFields(),
      );
    expect(Object.keys(parsed).sort()).toEqual([
      "bootstrapOriginDistributionRootBinding",
      "bootstrapTrustBundle",
      "bootstrapTrustBundleEnvelope",
      "strictEd25519AdversarialManifestEnvelope",
    ]);
    expect(() =>
      InstallationIdentityBootstrapTrustFieldsV1Schema.parse({
        ...retainedTrustFields(),
        profile: "invented_persistent_profile_v1",
      }),
    ).toThrow();
  });

  it("returns only a deep-frozen structure result for a complete closure", async () => {
    const result =
      await validateInstallationIdentityRetainedTrustStructureV1({
        retainedTrustFields: retainedTrustFields(),
        strictCryptoCapability,
      });

    expect(result).toMatchObject({
      authority: "none_structure_only",
    });
    expect(Object.keys(result).sort()).toEqual([
      "authority",
      "retainedTrustFields",
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.retainedTrustFields)).toBe(true);
    expect(
      Object.isFrozen(
        result.retainedTrustFields.bootstrapTrustBundleEnvelope.payload,
      ),
    ).toBe(true);
    expect("capability" in result).toBe(false);
    expect("authorized" in result).toBe(false);
  });

  it("rejects origin, retained Pin, and Envelope substitutions", async () => {
    const originMismatch = retainedTrustFields();
    originMismatch.bootstrapOriginDistributionRootBinding =
      signedDistributionBinding(
        bundlePin(REPLACEMENT_BUNDLE_CONTENT_DIGEST),
      );
    await expectAttestationInvalid(
      validateInstallationIdentityRetainedTrustStructureV1({
        retainedTrustFields: originMismatch,
        strictCryptoCapability,
      }),
    );

    const retainedPinMismatch = retainedTrustFields();
    retainedPinMismatch.bootstrapTrustBundle = bundlePin(
      REPLACEMENT_BUNDLE_CONTENT_DIGEST,
    );
    await expectAttestationInvalid(
      validateInstallationIdentityRetainedTrustStructureV1({
        retainedTrustFields: retainedPinMismatch,
        strictCryptoCapability,
      }),
    );

    const envelopeMismatch = retainedTrustFields();
    envelopeMismatch.bootstrapTrustBundleEnvelope.contentDigest =
      REPLACEMENT_BUNDLE_CONTENT_DIGEST;
    await expectAttestationInvalid(
      validateInstallationIdentityRetainedTrustStructureV1({
        retainedTrustFields: envelopeMismatch,
        strictCryptoCapability,
      }),
    );
  });

  it("rejects a substituted retained manifest and forged live capability", async () => {
    const manifestMismatch = retainedTrustFields();
    manifestMismatch.strictEd25519AdversarialManifestEnvelope.contentDigest =
      REPLACEMENT_BUNDLE_CONTENT_DIGEST;
    await expectAttestationInvalid(
      validateInstallationIdentityRetainedTrustStructureV1({
        retainedTrustFields: manifestMismatch,
        strictCryptoCapability,
      }),
    );

    await expectAttestationInvalid(
      validateInstallationIdentityRetainedTrustStructureV1({
        retainedTrustFields: retainedTrustFields(),
        strictCryptoCapability:
          Object.freeze(
            {},
          ) as ProviderStrictEd25519OpaqueCapabilityV1,
      }),
    );
  });

  it("rejects nested accessors without evaluating them", async () => {
    const retained = retainedTrustFields();
    let getterCalled = false;
    const originalPin = retained.bootstrapTrustBundle;
    Object.defineProperty(retained, "bootstrapTrustBundle", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalled = true;
        return originalPin;
      },
    });

    await expectAttestationInvalid(
      validateInstallationIdentityRetainedTrustStructureV1({
        retainedTrustFields: retained,
        strictCryptoCapability,
      }),
    );
    expect(getterCalled).toBe(false);
  });
});

describe("current versus historical bootstrap trust use", () => {
  it("returns a non-authoritative current candidate only for same-bundle strong_ready", async () => {
    const retained = retainedTrustFields();
    const result = await classifyInstallationBootstrapTrustUseStructureV1({
      retainedTrustFields: retained,
      currentDistributionRootBinding:
        retained.bootstrapOriginDistributionRootBinding,
      strictCryptoCapability,
      usage: {
        purpose: "ordinary_current_identity",
        acceptanceState: "strong_ready",
      },
    });

    expect(result).toEqual({
      outcome: "current_structure_candidate",
      authority: "none_structure_only",
      bundleSource: "retained_identity",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect("capability" in result).toBe(false);
  });

  it("returns migration_required for a valid different current bundle", async () => {
    const retained = retainedTrustFields();
    const result = await classifyInstallationBootstrapTrustUseStructureV1({
      retainedTrustFields: retained,
      currentDistributionRootBinding: currentBindingFor(
        bundlePin(REPLACEMENT_BUNDLE_CONTENT_DIGEST),
      ),
      strictCryptoCapability,
      usage: {
        purpose: "ordinary_current_identity",
        acceptanceState: "strong_ready",
      },
    });

    expect(result).toEqual({
      outcome: "provider_unavailable",
      reason: "migration_required",
    });
  });

  it.each(["migration_only", "recovery_only"] as const)(
    "keeps ordinary %s use migration-only even when the bundle is unchanged",
    async (acceptanceState) => {
      const retained = retainedTrustFields();
      await expect(
        classifyInstallationBootstrapTrustUseStructureV1({
          retainedTrustFields: retained,
          currentDistributionRootBinding:
            retained.bootstrapOriginDistributionRootBinding,
          strictCryptoCapability,
          usage: {
            purpose: "ordinary_current_identity",
            acceptanceState,
          },
        }),
      ).resolves.toEqual({
        outcome: "provider_unavailable",
        reason: "migration_required",
      });
    },
  );

  it("gives malformed retained trust precedence over migration_required", async () => {
    const retained = retainedTrustFields();
    retained.bootstrapTrustBundleEnvelope.contentDigest =
      REPLACEMENT_BUNDLE_CONTENT_DIGEST;

    await expectAttestationInvalid(
      classifyInstallationBootstrapTrustUseStructureV1({
        retainedTrustFields: retained,
        currentDistributionRootBinding: currentBindingFor(
          bundlePin(REPLACEMENT_BUNDLE_CONTENT_DIGEST),
        ),
        strictCryptoCapability,
        usage: {
          purpose: "ordinary_current_identity",
          acceptanceState: "strong_ready",
        },
      }),
    );
  });

  it("uses only retained old trust for a different-bundle recovery source", async () => {
    const retained = retainedTrustFields();
    const replacementPin = bundlePin(
      REPLACEMENT_BUNDLE_CONTENT_DIGEST,
    );
    const result = await classifyInstallationBootstrapTrustUseStructureV1({
      retainedTrustFields: retained,
      currentDistributionRootBinding:
        currentBindingFor(replacementPin),
      strictCryptoCapability,
      usage: {
        purpose: "historical_recovery_source_read",
        sourceAcceptanceState: "recovery_only",
        sourceAcceptanceReason:
          "recovery_key_compromise_requires_new_installation_identity",
        migrationPlanSourceBootstrapTrustBundle:
          retained.bootstrapTrustBundle,
        migrationPlanDestinationBootstrapTrustBundle: replacementPin,
      },
    });

    expect(result).toEqual({
      outcome:
        "historical_recovery_source_structure_candidate",
      authority: "none_structure_only",
      bundleSource: "retained_source_identity_only",
      strongWrites: "forbidden",
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects historical Plan Pin and recovery-reason substitutions", async () => {
    const retained = retainedTrustFields();
    const replacementPin = bundlePin(
      REPLACEMENT_BUNDLE_CONTENT_DIGEST,
    );
    const currentDistributionRootBinding =
      currentBindingFor(replacementPin);

    await expectAttestationInvalid(
      classifyInstallationBootstrapTrustUseStructureV1({
        retainedTrustFields: retained,
        currentDistributionRootBinding,
        strictCryptoCapability,
        usage: {
          purpose: "historical_recovery_source_read",
          sourceAcceptanceState: "recovery_only",
          sourceAcceptanceReason:
            "recovery_key_compromise_requires_new_installation_identity",
          migrationPlanSourceBootstrapTrustBundle: replacementPin,
          migrationPlanDestinationBootstrapTrustBundle: replacementPin,
        },
      }),
    );

    await expectAttestationInvalid(
      classifyInstallationBootstrapTrustUseStructureV1({
        retainedTrustFields: retained,
        currentDistributionRootBinding,
        strictCryptoCapability,
        usage: {
          purpose: "historical_recovery_source_read",
          sourceAcceptanceState: "recovery_only",
          sourceAcceptanceReason:
            "root_compromise_pending_resign_or_migration",
          migrationPlanSourceBootstrapTrustBundle:
            retained.bootstrapTrustBundle,
          migrationPlanDestinationBootstrapTrustBundle:
            replacementPin,
        },
      }),
    );
  });

  it("rejects recovery-key compromise without a new bundle", async () => {
    const retained = retainedTrustFields();
    await expectAttestationInvalid(
      classifyInstallationBootstrapTrustUseStructureV1({
        retainedTrustFields: retained,
        currentDistributionRootBinding:
          retained.bootstrapOriginDistributionRootBinding,
        strictCryptoCapability,
        usage: {
          purpose: "historical_recovery_source_read",
          sourceAcceptanceState: "recovery_only",
          sourceAcceptanceReason:
            "recovery_key_compromise_requires_new_installation_identity",
          migrationPlanSourceBootstrapTrustBundle:
            retained.bootstrapTrustBundle,
          migrationPlanDestinationBootstrapTrustBundle:
            retained.bootstrapTrustBundle,
        },
      }),
    );
  });
});
