import { z } from "zod";

import {
  ProviderBootstrapTrustBundleEnvelopeV1Schema,
  ProviderBootstrapTrustStructureError,
  validateProviderBootstrapTrustBundleStructureV1,
} from "./bootstrap-trust-bundle.js";
import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ProviderBootstrapTrustBundlePinV1Schema,
  ProviderSignedDistributionRootBindingV1Schema,
  validateProviderSignedDistributionRootBindingStructureV1,
  type ProviderBootstrapTrustBundlePinV1,
  type ProviderSignedDistributionRootBindingV1,
} from "./provider-distribution-trust.js";
import {
  ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

export const InstallationIdentityBootstrapTrustFieldsV1Schema =
  z.strictObject({
    bootstrapOriginDistributionRootBinding:
      ProviderSignedDistributionRootBindingV1Schema,
    bootstrapTrustBundle: ProviderBootstrapTrustBundlePinV1Schema,
    bootstrapTrustBundleEnvelope:
      ProviderBootstrapTrustBundleEnvelopeV1Schema,
    strictEd25519AdversarialManifestEnvelope:
      ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema,
  });
export type InstallationIdentityBootstrapTrustFieldsV1 = z.infer<
  typeof InstallationIdentityBootstrapTrustFieldsV1Schema
>;

export interface ValidateInstallationIdentityRetainedTrustStructureV1Input {
  readonly retainedTrustFields: unknown;
  readonly strictCryptoCapability:
    ProviderStrictEd25519OpaqueCapabilityV1;
}

export interface InstallationIdentityRetainedTrustStructureValidationV1 {
  readonly authority: "none_structure_only";
  readonly retainedTrustFields:
    InstallationIdentityBootstrapTrustFieldsV1;
}

export type InstallationBootstrapTrustRecoveryOnlyReasonV1 =
  | "root_compromise_pending_resign_or_migration"
  | "recovery_key_compromise_requires_new_installation_identity";

export type InstallationBootstrapTrustUseV1 =
  | {
      readonly purpose: "ordinary_current_identity";
      readonly acceptanceState:
        | "strong_ready"
        | "migration_only"
        | "recovery_only";
    }
  | {
      readonly purpose: "historical_recovery_source_read";
      readonly sourceAcceptanceState: "recovery_only";
      readonly sourceAcceptanceReason:
        InstallationBootstrapTrustRecoveryOnlyReasonV1;
      readonly migrationPlanSourceBootstrapTrustBundle:
        ProviderBootstrapTrustBundlePinV1;
      readonly migrationPlanDestinationBootstrapTrustBundle:
        ProviderBootstrapTrustBundlePinV1;
    };

export interface ClassifyInstallationBootstrapTrustUseStructureV1Input {
  readonly retainedTrustFields: unknown;
  readonly currentDistributionRootBinding: unknown;
  readonly strictCryptoCapability:
    ProviderStrictEd25519OpaqueCapabilityV1;
  readonly usage: InstallationBootstrapTrustUseV1;
}

export type InstallationBootstrapTrustUseStructureAssessmentV1 =
  | {
      readonly outcome: "current_structure_candidate";
      readonly authority: "none_structure_only";
      readonly bundleSource: "retained_identity";
    }
  | {
      readonly outcome:
        "historical_recovery_source_structure_candidate";
      readonly authority: "none_structure_only";
      readonly bundleSource: "retained_source_identity_only";
      readonly strongWrites: "forbidden";
    }
  | {
      readonly outcome: "provider_unavailable";
      readonly reason: "migration_required";
    };

const InstallationBootstrapTrustUseV1Schema = z.discriminatedUnion(
  "purpose",
  [
    z.strictObject({
      purpose: z.literal("ordinary_current_identity"),
      acceptanceState: z.enum([
        "strong_ready",
        "migration_only",
        "recovery_only",
      ]),
    }),
    z.strictObject({
      purpose: z.literal("historical_recovery_source_read"),
      sourceAcceptanceState: z.literal("recovery_only"),
      sourceAcceptanceReason: z.enum([
        "root_compromise_pending_resign_or_migration",
        "recovery_key_compromise_requires_new_installation_identity",
      ]),
      migrationPlanSourceBootstrapTrustBundle:
        ProviderBootstrapTrustBundlePinV1Schema,
      migrationPlanDestinationBootstrapTrustBundle:
        ProviderBootstrapTrustBundlePinV1Schema,
    }),
  ],
);

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function equalCanonicalJson(left: unknown, right: unknown): boolean {
  return equalBytes(
    canonicalizeJcsSafeIntegerUtf8V1(left),
    canonicalizeJcsSafeIntegerUtf8V1(right),
  );
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function requireExactInputFields(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, PropertyDescriptor>> {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const actualKeys = Object.keys(descriptors).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new TypeError("invalid trust-structure input");
  }
  return descriptors;
}

function pinForBundleEnvelope(
  envelope: z.infer<
    typeof ProviderBootstrapTrustBundleEnvelopeV1Schema
  >,
): ProviderBootstrapTrustBundlePinV1 {
  return ProviderBootstrapTrustBundlePinV1Schema.parse({
    locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
    contentDigest: envelope.contentDigest,
  });
}

async function validateRetainedTrustInternalV1(
  input: ValidateInstallationIdentityRetainedTrustStructureV1Input,
): Promise<InstallationIdentityBootstrapTrustFieldsV1> {
  const descriptors = requireExactInputFields(input, [
    "retainedTrustFields",
    "strictCryptoCapability",
  ]);
  const retainedTrustFields = descriptors.retainedTrustFields?.value;
  const strictCryptoCapability = descriptors.strictCryptoCapability?.value as
    | ProviderStrictEd25519OpaqueCapabilityV1
    | undefined;
  if (strictCryptoCapability === undefined) {
    throw new TypeError("missing strict crypto capability");
  }

  assertJsonDataTreeBeforeSchemaV1(retainedTrustFields);
  const retained =
    InstallationIdentityBootstrapTrustFieldsV1Schema.parse(
      retainedTrustFields,
    );
  const originBinding =
    validateProviderSignedDistributionRootBindingStructureV1(
      retained.bootstrapOriginDistributionRootBinding,
    );
  const envelopePin = pinForBundleEnvelope(
    retained.bootstrapTrustBundleEnvelope,
  );

  if (
    !equalCanonicalJson(
      originBinding.bootstrapTrustBundle,
      retained.bootstrapTrustBundle,
    ) ||
    !equalCanonicalJson(
      retained.bootstrapTrustBundle,
      envelopePin,
    )
  ) {
    throw new TypeError("retained bootstrap trust pin mismatch");
  }

  await validateProviderBootstrapTrustBundleStructureV1({
    bundleEnvelopeBytes: canonicalizeJcsSafeIntegerUtf8V1(
      retained.bootstrapTrustBundleEnvelope,
    ),
    strictManifestEnvelopeBytes: canonicalizeJcsSafeIntegerUtf8V1(
      retained.strictEd25519AdversarialManifestEnvelope,
    ),
    strictCryptoCapability,
  });

  return deepFreezeJson(retained);
}

export async function validateInstallationIdentityRetainedTrustStructureV1(
  input: ValidateInstallationIdentityRetainedTrustStructureV1Input,
): Promise<InstallationIdentityRetainedTrustStructureValidationV1> {
  try {
    const retainedTrustFields =
      await validateRetainedTrustInternalV1(input);
    return deepFreezeJson({
      authority: "none_structure_only" as const,
      retainedTrustFields,
    });
  } catch {
    throw new ProviderBootstrapTrustStructureError();
  }
}

function verifiedCurrentBinding(
  input: unknown,
): ProviderSignedDistributionRootBindingV1 {
  assertJsonDataTreeBeforeSchemaV1(input);
  return validateProviderSignedDistributionRootBindingStructureV1(input);
}

const CURRENT_STRUCTURE_CANDIDATE = Object.freeze({
  outcome: "current_structure_candidate",
  authority: "none_structure_only",
  bundleSource: "retained_identity",
} as const);

const HISTORICAL_STRUCTURE_CANDIDATE = Object.freeze({
  outcome: "historical_recovery_source_structure_candidate",
  authority: "none_structure_only",
  bundleSource: "retained_source_identity_only",
  strongWrites: "forbidden",
} as const);

const MIGRATION_REQUIRED = Object.freeze({
  outcome: "provider_unavailable",
  reason: "migration_required",
} as const);

async function classifyTrustUseInternalV1(
  input: ClassifyInstallationBootstrapTrustUseStructureV1Input,
): Promise<InstallationBootstrapTrustUseStructureAssessmentV1> {
  const descriptors = requireExactInputFields(input, [
    "currentDistributionRootBinding",
    "retainedTrustFields",
    "strictCryptoCapability",
    "usage",
  ]);
  const retainedTrustFields = descriptors.retainedTrustFields?.value;
  const strictCryptoCapability = descriptors.strictCryptoCapability?.value as
    | ProviderStrictEd25519OpaqueCapabilityV1
    | undefined;
  if (strictCryptoCapability === undefined) {
    throw new TypeError("missing strict crypto capability");
  }

  const currentBinding = verifiedCurrentBinding(
    descriptors.currentDistributionRootBinding?.value,
  );
  assertJsonDataTreeBeforeSchemaV1(descriptors.usage?.value);
  const usage = InstallationBootstrapTrustUseV1Schema.parse(
    descriptors.usage?.value,
  );

  // Complete trust validation deliberately precedes every applicability
  // comparison so malformed retained state can never become migration_required.
  const retained = await validateRetainedTrustInternalV1({
    retainedTrustFields,
    strictCryptoCapability,
  });

  if (usage.purpose === "ordinary_current_identity") {
    if (
      usage.acceptanceState === "strong_ready" &&
      equalCanonicalJson(
        currentBinding.bootstrapTrustBundle,
        retained.bootstrapTrustBundle,
      )
    ) {
      return CURRENT_STRUCTURE_CANDIDATE;
    }
    return MIGRATION_REQUIRED;
  }

  if (
    !equalCanonicalJson(
      usage.migrationPlanSourceBootstrapTrustBundle,
      retained.bootstrapTrustBundle,
    ) ||
    !equalCanonicalJson(
      usage.migrationPlanDestinationBootstrapTrustBundle,
      currentBinding.bootstrapTrustBundle,
    )
  ) {
    throw new TypeError("historical migration trust pin mismatch");
  }

  const bundleChanged = !equalCanonicalJson(
    retained.bootstrapTrustBundle,
    currentBinding.bootstrapTrustBundle,
  );
  if (
    (bundleChanged &&
      usage.sourceAcceptanceReason !==
        "recovery_key_compromise_requires_new_installation_identity") ||
    (!bundleChanged &&
      usage.sourceAcceptanceReason ===
        "recovery_key_compromise_requires_new_installation_identity")
  ) {
    throw new TypeError("historical recovery reason mismatch");
  }

  return HISTORICAL_STRUCTURE_CANDIDATE;
}

export async function classifyInstallationBootstrapTrustUseStructureV1(
  input: ClassifyInstallationBootstrapTrustUseStructureV1Input,
): Promise<InstallationBootstrapTrustUseStructureAssessmentV1> {
  try {
    return await classifyTrustUseInternalV1(input);
  } catch {
    throw new ProviderBootstrapTrustStructureError();
  }
}
