import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ProviderBootstrapTrustGoldenManifestV1Schema,
} from "../src/bootstrap-trust-golden.js";
import {
  PROVIDER_SIGNED_PACKAGE_IDENTITY_DOMAIN_V1,
  ProviderBootstrapTrustBundlePinV1Schema,
  ProviderSignedDistributionRootBindingV1Schema,
  ProviderSignedPackageIdentityFieldsV1Schema,
  deriveProviderSignedPackageIdentityDigestV1,
  validateProviderSignedDistributionRootBindingStructureV1,
} from "../src/provider-distribution-trust.js";
import {
  PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1,
  PROVIDER_TRUST_HISTORY_POLICY_V1,
} from "../src/provider-trust-policy.js";

const bootstrapGolden =
  ProviderBootstrapTrustGoldenManifestV1Schema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL(
            "../fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    ),
  );
const signedPackageIdentityVector =
  bootstrapGolden.vectors.signedPackageIdentityDigest;
const releaseRevisionDigest =
  signedPackageIdentityVector.fields.releaseRevisionDigest;
const bundleContentDigest =
  signedPackageIdentityVector.fields.bootstrapTrustBundle.contentDigest;
const expectedSignedPackageIdentityDigest =
  signedPackageIdentityVector.expected.contentDigest;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function signedPackageIdentityFields(): Record<string, unknown> {
  return cloneJson(signedPackageIdentityVector.fields);
}

function signedDistributionRootBinding(): Record<string, unknown> {
  return {
    profile: "provider_signed_distribution_root_binding_v1",
    signedPackageIdentityDigest: expectedSignedPackageIdentityDigest,
    ...signedPackageIdentityFields(),
  };
}

describe("signed package distribution trust", () => {
  it("freezes the exact domain projection into an independent digest golden", () => {
    expect(PROVIDER_SIGNED_PACKAGE_IDENTITY_DOMAIN_V1).toBe(
      "provider-signed-package-identity-v1",
    );

    const fields = signedPackageIdentityFields();
    expect(ProviderSignedPackageIdentityFieldsV1Schema.parse(fields)).toEqual(
      fields,
    );
    expect(
      deriveProviderSignedPackageIdentityDigestV1(fields),
    ).toBe(expectedSignedPackageIdentityDigest);

    const binding = signedDistributionRootBinding();
    expect(ProviderSignedDistributionRootBindingV1Schema.parse(binding)).toEqual(
      binding,
    );
    expect(
      validateProviderSignedDistributionRootBindingStructureV1(binding),
    ).toEqual(binding);
  });

  it("accepts only the fixed bootstrap pin and distribution policy", () => {
    expect(
      ProviderBootstrapTrustBundlePinV1Schema.parse({
        locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
        contentDigest: bundleContentDigest,
      }),
    ).toEqual({
      locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
      contentDigest: bundleContentDigest,
    });

    const changedLimit = signedPackageIdentityFields();
    changedLimit.historyPolicy = {
      ...cloneJson(PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1),
      maxTotalRetainedDistributionObjectCount: 65_537,
    };
    expect(() =>
      deriveProviderSignedPackageIdentityDigestV1(changedLimit),
    ).toThrow();

    const changedAdmission = signedPackageIdentityFields();
    changedAdmission.historyPolicy = {
      ...cloneJson(PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1),
      admission: "stream_then_accept",
    };
    expect(() =>
      deriveProviderSignedPackageIdentityDigestV1(changedAdmission),
    ).toThrow();

    const mixedPolicy = signedPackageIdentityFields();
    mixedPolicy.historyPolicy = cloneJson(PROVIDER_TRUST_HISTORY_POLICY_V1);
    expect(() =>
      deriveProviderSignedPackageIdentityDigestV1(mixedPolicy),
    ).toThrow();
  });

  it("rejects strict-schema extra fields at every signed projection layer", () => {
    expect(() =>
      deriveProviderSignedPackageIdentityDigestV1({
        ...signedPackageIdentityFields(),
        physicalPath: "/caller/controlled/package",
      }),
    ).toThrow();

    const pinExtra = signedPackageIdentityFields();
    pinExtra.bootstrapTrustBundle = {
      ...(pinExtra.bootstrapTrustBundle as Record<string, unknown>),
      aliasPath: "provider/alternate-bootstrap.json",
    };
    expect(() =>
      deriveProviderSignedPackageIdentityDigestV1(pinExtra),
    ).toThrow();

    const policyExtra = signedPackageIdentityFields();
    policyExtra.historyPolicy = {
      ...(policyExtra.historyPolicy as Record<string, unknown>),
      unboundedHistory: true,
    };
    expect(() =>
      deriveProviderSignedPackageIdentityDigestV1(policyExtra),
    ).toThrow();

    expect(() =>
      validateProviderSignedDistributionRootBindingStructureV1({
        ...signedDistributionRootBinding(),
        packagePath: "/caller/controlled/package",
      }),
    ).toThrow();
  });

  it("rejects digest and signed binding field substitutions", () => {
    expect(() =>
      validateProviderSignedDistributionRootBindingStructureV1({
        ...signedDistributionRootBinding(),
        signedPackageIdentityDigest: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow(/signed package identity digest mismatch/u);
    expect(() =>
      validateProviderSignedDistributionRootBindingStructureV1({
        ...signedDistributionRootBinding(),
        signedPackageIdentityDigest: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow(/signed package identity digest mismatch/u);

    expect(() =>
      validateProviderSignedDistributionRootBindingStructureV1({
        ...signedDistributionRootBinding(),
        releaseRevisionDigest: `sha256:${"3".repeat(64)}`,
      }),
    ).toThrow(/signed package identity digest mismatch/u);

    expect(() =>
      validateProviderSignedDistributionRootBindingStructureV1({
        ...signedDistributionRootBinding(),
        bootstrapTrustBundle: {
          locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
          contentDigest: `sha256:${"4".repeat(64)}`,
        },
      }),
    ).toThrow(/signed package identity digest mismatch/u);

    expect(() =>
      validateProviderSignedDistributionRootBindingStructureV1({
        ...signedDistributionRootBinding(),
        resolverProfile: "caller_selected_distribution_root_v1",
      }),
    ).toThrow();
  });

  it("rejects top-level prototypes and accessors without invoking them", () => {
    const prototypeInput = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      signedPackageIdentityFields(),
    );
    expect(() =>
      deriveProviderSignedPackageIdentityDigestV1(prototypeInput),
    ).toThrow(/plain data object/u);

    let getterInvoked = false;
    const accessorInput = signedDistributionRootBinding();
    Object.defineProperty(accessorInput, "resolverProfile", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return "verified_signed_package_distribution_root_v1";
      },
    });
    expect(() =>
      validateProviderSignedDistributionRootBindingStructureV1(accessorInput),
    ).toThrow(/enumerable data property/u);
    expect(getterInvoked).toBe(false);
  });

  it("rejects nested bootstrap-pin prototypes before digesting", () => {
    const fields = signedPackageIdentityFields();
    fields.bootstrapTrustBundle = Object.assign(
      Object.create({}) as Record<string, unknown>,
      fields.bootstrapTrustBundle,
    );
    expect(() =>
      deriveProviderSignedPackageIdentityDigestV1(fields),
    ).toThrow();
  });

  it("rejects nested accessors without executing caller code", () => {
    let pinGetterInvoked = false;
    const pinFields = signedPackageIdentityFields();
    const pin = {
      locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
    };
    Object.defineProperty(pin, "contentDigest", {
      enumerable: true,
      get() {
        pinGetterInvoked = true;
        return bundleContentDigest;
      },
    });
    pinFields.bootstrapTrustBundle = pin;

    expect(() =>
      deriveProviderSignedPackageIdentityDigestV1(pinFields),
    ).toThrow(/enumerable data propert/u);
    expect(pinGetterInvoked).toBe(false);

    let policyGetterInvoked = false;
    const policyFields = signedPackageIdentityFields();
    const policy = cloneJson(PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1);
    Object.defineProperty(policy, "admission", {
      enumerable: true,
      get() {
        policyGetterInvoked = true;
        return PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1.admission;
      },
    });
    policyFields.historyPolicy = policy;

    expect(() =>
      deriveProviderSignedPackageIdentityDigestV1(policyFields),
    ).toThrow(/enumerable data propert/u);
    expect(policyGetterInvoked).toBe(false);
  });

  it("returns a parsed binding detached from later caller mutations", () => {
    const input = signedDistributionRootBinding();
    const verified =
      validateProviderSignedDistributionRootBindingStructureV1(input);
    const inputPin = input.bootstrapTrustBundle as Record<string, unknown>;
    inputPin.contentDigest = `sha256:${"f".repeat(64)}`;

    expect(verified.bootstrapTrustBundle.contentDigest).toBe(
      bundleContentDigest,
    );
    expect(verified.historyPolicy).toEqual(
      PROVIDER_DISTRIBUTION_HISTORY_POLICY_V1,
    );
    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(verified.bootstrapTrustBundle)).toBe(true);
    expect(Object.isFrozen(verified.historyPolicy)).toBe(true);
    expect(() => {
      (
        verified.bootstrapTrustBundle as {
          contentDigest: string;
        }
      ).contentDigest = `sha256:${"e".repeat(64)}`;
    }).toThrow();
  });
});
