import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import {
  ContentDigestV1Schema,
} from "./primitives.js";
import {
  ProviderDistributionHistoryPolicyV1Schema,
} from "./provider-trust-policy.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectValuesV1 = Object.values;
const CapturedReflectApplyV1 = Reflect.apply;

function objectFreezeV1<T>(value: T): Readonly<T> {
  return CapturedReflectApplyV1(CapturedObjectFreezeV1, undefined, [
    value,
  ]) as Readonly<T>;
}

function objectValuesV1(value: object): unknown[] {
  return CapturedReflectApplyV1(CapturedObjectValuesV1, undefined, [
    value,
  ]) as unknown[];
}

export const PROVIDER_SIGNED_PACKAGE_IDENTITY_DOMAIN_V1 =
  "provider-signed-package-identity-v1" as const;

export const ProviderBootstrapTrustBundlePinV1Schema = z.strictObject({
  locatorProfile: z.literal(
    "distribution_provider_bootstrap_trust_bundle_v1",
  ),
  contentDigest: ContentDigestV1Schema,
});
export type ProviderBootstrapTrustBundlePinV1 = z.infer<
  typeof ProviderBootstrapTrustBundlePinV1Schema
>;

export const ProviderSignedPackageIdentityFieldsV1Schema = z
  .strictObject({
    resolverProfile: z.literal(
      "verified_signed_package_distribution_root_v1",
    ),
    releaseRevisionDigest: ContentDigestV1Schema,
    bootstrapTrustBundle: ProviderBootstrapTrustBundlePinV1Schema,
    historyPolicy: ProviderDistributionHistoryPolicyV1Schema,
  })
  .brand<"ProviderSignedPackageIdentityFieldsV1">();
export type ProviderSignedPackageIdentityFieldsV1 = z.infer<
  typeof ProviderSignedPackageIdentityFieldsV1Schema
>;

export const ProviderSignedDistributionRootBindingV1Schema = z.strictObject({
  profile: z.literal("provider_signed_distribution_root_binding_v1"),
  resolverProfile: z.literal(
    "verified_signed_package_distribution_root_v1",
  ),
  signedPackageIdentityDigest: ContentDigestV1Schema,
  releaseRevisionDigest: ContentDigestV1Schema,
  bootstrapTrustBundle: ProviderBootstrapTrustBundlePinV1Schema,
  historyPolicy: ProviderDistributionHistoryPolicyV1Schema,
});
export type ProviderSignedDistributionRootBindingV1 = z.infer<
  typeof ProviderSignedDistributionRootBindingV1Schema
>;

function bytesToLowerHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of objectValuesV1(value)) deepFreezeJson(child);
    objectFreezeV1(value);
  }
  return value;
}

function contentDigestForDomain(
  domain: string,
  fields: object,
): ReturnType<typeof ContentDigestV1Schema.parse> {
  const preimage = createDomainPreimageBytesV1(domain, fields);
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHex(sha256InternalV1(preimage))}`,
  );
}

export function deriveProviderSignedPackageIdentityDigestV1(
  input: unknown,
): ReturnType<typeof ContentDigestV1Schema.parse> {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const fields = ProviderSignedPackageIdentityFieldsV1Schema.parse(input);
  return contentDigestForDomain(
    PROVIDER_SIGNED_PACKAGE_IDENTITY_DOMAIN_V1,
    fields,
  );
}

export function validateProviderSignedDistributionRootBindingStructureV1(
  input: unknown,
): ProviderSignedDistributionRootBindingV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const binding = ProviderSignedDistributionRootBindingV1Schema.parse(input);
  const expectedDigest = deriveProviderSignedPackageIdentityDigestV1({
    resolverProfile: binding.resolverProfile,
    releaseRevisionDigest: binding.releaseRevisionDigest,
    bootstrapTrustBundle: binding.bootstrapTrustBundle,
    historyPolicy: binding.historyPolicy,
  });
  if (binding.signedPackageIdentityDigest !== expectedDigest) {
    throw new TypeError("signed package identity digest mismatch");
  }
  return deepFreezeJson(binding);
}
