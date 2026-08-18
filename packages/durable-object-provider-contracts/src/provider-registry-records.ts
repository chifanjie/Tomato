import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  CanonicalPublicKeyBytes32V1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  Ed25519PublicKeyDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderFeasibilityApproverKeyIdV1Schema,
  ProviderFeasibilityEvidenceIdV1Schema,
  ProviderMigrationIdV1Schema,
  ProviderOsReleaseFamilyCodeV1Schema,
  ProviderRegistryManifestGenerationIdV1Schema,
  ProviderRegistryManifestSignatureV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
  StoreProviderRegistrySignatureV1Schema,
  StoreProviderVerificationKeyIdV1Schema,
  type ContentDigestV1,
  type ProviderFeasibilityApproverKeyIdV1,
  type ProviderRegistryManifestGenerationIdV1,
  type StoreProviderVerificationKeyIdV1,
} from "./primitives.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
  deriveProviderEd25519PublicKeyDigestInternalV1,
} from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;

function objectGetOwnPropertyDescriptorsV1(
  value: object,
): PropertyDescriptorMap {
  return CapturedReflectApplyV1(
    CapturedObjectGetOwnPropertyDescriptorsV1,
    undefined,
    [value],
  ) as PropertyDescriptorMap;
}

function regExpExecV1(pattern: RegExp, value: string): RegExpExecArray | null {
  return CapturedReflectApplyV1(CapturedRegExpPrototypeExecV1, pattern, [
    value,
  ]) as RegExpExecArray | null;
}

export const STORE_PROVIDER_VERIFICATION_KEY_ID_DOMAIN_V1 =
  "store-provider-verification-key-id-v1" as const;
export const PROVIDER_FEASIBILITY_APPROVER_KEY_ID_DOMAIN_V1 =
  "provider-feasibility-approver-key-id-v1" as const;
export const STORE_DURABLE_OBJECT_PROVIDER_RUNTIME_ATTESTATION_DOMAIN_V1 =
  "store-durable-object-provider-runtime-attestation-v1" as const;
export const STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_DOMAIN_V1 =
  "store-durable-object-provider-registry-entry-v1" as const;
export const PROVIDER_REGISTRY_MANIFEST_ID_DOMAIN_V1 =
  "provider-registry-manifest-id-v1" as const;
export const PROVIDER_REGISTRY_MANIFEST_DOMAIN_V1 =
  "provider-registry-manifest-v1" as const;

export const STORE_PROVIDER_RUNTIME_ATTESTATION_SIGNATURE_DOMAIN_V1 =
  "store-provider-runtime-attestation-signature-v1" as const;
export const STORE_DURABLE_OBJECT_PROVIDER_VERIFICATION_PUBLIC_KEY_SIGNATURE_DOMAIN_V1 =
  "store-durable-object-provider-verification-public-key-signature-v1" as const;
export const STORE_DURABLE_OBJECT_PROVIDER_BINDING_DERIVATION_GENERATION_SIGNATURE_DOMAIN_V1 =
  "store-durable-object-provider-binding-derivation-generation-signature-v1" as const;
export const PROVIDER_FEASIBILITY_APPROVER_PUBLIC_KEY_SIGNATURE_DOMAIN_V1 =
  "provider-feasibility-approver-public-key-signature-v1" as const;
export const STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_SIGNATURE_DOMAIN_V1 =
  "store-durable-object-provider-registry-entry-signature-v1" as const;
export const PROVIDER_REGISTRY_MANIFEST_SIGNATURE_DOMAIN_V1 =
  "provider-registry-manifest-signature-v1" as const;

const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);
const SuccessorSafeIntegerV1Schema = z
  .number()
  .int()
  .min(2)
  .max(Number.MAX_SAFE_INTEGER);

function bytesToLowerHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHex(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

function shortHexForDomainV1(domain: string, fields: object): string {
  return bytesToLowerHex(
    sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
  ).slice(0, 22);
}

function compareUtf8BytewiseV1(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const sharedLength = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) {
      return leftBytes[index]! - rightBytes[index]!;
    }
  }
  return leftBytes.length - rightBytes.length;
}

function assertStrictlyIncreasingV1<T>(
  values: readonly T[],
  compare: (left: T, right: T) => number,
  context: z.RefinementCtx,
  message: string,
): void {
  for (let index = 1; index < values.length; index += 1) {
    if (compare(values[index - 1]!, values[index]!) >= 0) {
      context.addIssue({ code: "custom", message, path: [index] });
      return;
    }
  }
}

function compareStringTupleV1(
  left: readonly string[],
  right: readonly string[],
): number {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const order = compareUtf8BytewiseV1(left[index]!, right[index]!);
    if (order !== 0) return order;
  }
  return left.length - right.length;
}

export const StoreDurableObjectProviderVerificationKeyUsageV1Schema = z.enum([
  "operation_receipt",
  "containment_proof",
  "state_version",
  "journal_version",
  "migration_semantic_proof",
  "strong_mutation_authority_grant",
]);
export type StoreDurableObjectProviderVerificationKeyUsageV1 = z.infer<
  typeof StoreDurableObjectProviderVerificationKeyUsageV1Schema
>;

export const StoreProviderVerificationKeyIdFieldsV1Schema = z
  .strictObject({
    providerId: DurableObjectIdentityProviderIdV1Schema,
    usage: StoreDurableObjectProviderVerificationKeyUsageV1Schema,
    publicKeyBytes: CanonicalPublicKeyBytes32V1Schema,
  })
  .brand<"StoreProviderVerificationKeyIdFieldsV1">();
export type StoreProviderVerificationKeyIdFieldsV1 = z.infer<
  typeof StoreProviderVerificationKeyIdFieldsV1Schema
>;

export const ProviderFeasibilityApproverKeyIdFieldsV1Schema = z
  .strictObject({
    role: z.enum(["qa", "release"]),
    publicKeyBytes: CanonicalPublicKeyBytes32V1Schema,
  })
  .brand<"ProviderFeasibilityApproverKeyIdFieldsV1">();
export type ProviderFeasibilityApproverKeyIdFieldsV1 = z.infer<
  typeof ProviderFeasibilityApproverKeyIdFieldsV1Schema
>;

const runtimeAttestationUnsignedShapeV1 = {
  profile: z.literal("store_durable_object_provider_runtime_attestation_v1"),
  providerId: DurableObjectIdentityProviderIdV1Schema,
  semanticProviderPolicyDigest: ContentDigestV1Schema,
  implementationDigest: ContentDigestV1Schema,
  binaryAttestationDigest: ContentDigestV1Schema,
  ipcEndpointAttestationDigest: ContentDigestV1Schema,
  osPlatform: z.enum(["darwin", "linux", "win32"]),
  osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1Schema,
  osBuildDigest: ContentDigestV1Schema,
  architecture: z.enum(["arm64", "x86_64"]),
  filesystemProfileDigest: ContentDigestV1Schema,
  realFilesystemConformanceResultDigest: ContentDigestV1Schema,
  attestationGeneration: PositiveSafeIntegerV1Schema,
  issuedAt: ProviderRegistryIsoTimestampV1Schema,
} as const;

export const StoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1Schema =
  z.strictObject(runtimeAttestationUnsignedShapeV1);
export type StoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1 =
  z.infer<
    typeof StoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1Schema
  >;

export const StoreDurableObjectProviderRuntimeAttestationV1Schema =
  z.strictObject({
    ...runtimeAttestationUnsignedShapeV1,
    registrySignature: StoreProviderRegistrySignatureV1Schema,
  });
export type StoreDurableObjectProviderRuntimeAttestationV1 = z.infer<
  typeof StoreDurableObjectProviderRuntimeAttestationV1Schema
>;

export const StoreDurableObjectProviderRuntimeAttestationPinV1Schema =
  z.strictObject({
    profile: z.literal(
      "store_durable_object_provider_runtime_attestation_pin_v1",
    ),
    contentDigest: ContentDigestV1Schema,
    payload: StoreDurableObjectProviderRuntimeAttestationV1Schema,
  });
export type StoreDurableObjectProviderRuntimeAttestationPinV1 = z.infer<
  typeof StoreDurableObjectProviderRuntimeAttestationPinV1Schema
>;

const verificationPublicKeyUnsignedShapeV1 = {
  profile: z.literal(
    "store_durable_object_provider_verification_public_key_v1",
  ),
  providerId: DurableObjectIdentityProviderIdV1Schema,
  registryGenerationIntroduced: PositiveSafeIntegerV1Schema,
  keyId: StoreProviderVerificationKeyIdV1Schema,
  usage: StoreDurableObjectProviderVerificationKeyUsageV1Schema,
  algorithm: z.literal("ed25519"),
  publicKeyBytes: CanonicalPublicKeyBytes32V1Schema,
  publicKeyDigest: Ed25519PublicKeyDigestV1Schema,
} as const;

export const StoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1Schema =
  z.strictObject(verificationPublicKeyUnsignedShapeV1);
export type StoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1 =
  z.infer<
    typeof StoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1Schema
  >;

export const StoreDurableObjectProviderVerificationPublicKeyV1Schema =
  z.strictObject({
    ...verificationPublicKeyUnsignedShapeV1,
    registrySignature: StoreProviderRegistrySignatureV1Schema,
  });
export type StoreDurableObjectProviderVerificationPublicKeyV1 = z.infer<
  typeof StoreDurableObjectProviderVerificationPublicKeyV1Schema
>;

const bindingDerivationGenerationUnsignedShapeV1 = {
  profile: z.literal(
    "store_durable_object_provider_binding_derivation_generation_v1",
  ),
  providerId: DurableObjectIdentityProviderIdV1Schema,
  registryGenerationIntroduced: PositiveSafeIntegerV1Schema,
  generation: PositiveSafeIntegerV1Schema,
  algorithm: z.literal("hmac_sha256_provider_private"),
  keyCommitmentDigest: ContentDigestV1Schema,
} as const;

export const StoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1Schema =
  z.strictObject(bindingDerivationGenerationUnsignedShapeV1);
export type StoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1 =
  z.infer<
    typeof StoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1Schema
  >;

export const StoreDurableObjectProviderBindingDerivationGenerationV1Schema =
  z.strictObject({
    ...bindingDerivationGenerationUnsignedShapeV1,
    registrySignature: StoreProviderRegistrySignatureV1Schema,
  });
export type StoreDurableObjectProviderBindingDerivationGenerationV1 = z.infer<
  typeof StoreDurableObjectProviderBindingDerivationGenerationV1Schema
>;

const feasibilityApproverPublicKeyUnsignedShapeV1 = {
  profile: z.literal("provider_feasibility_approver_public_key_v1"),
  distributionRegistryGenerationIntroduced: PositiveSafeIntegerV1Schema,
  role: z.enum(["qa", "release"]),
  keyId: ProviderFeasibilityApproverKeyIdV1Schema,
  algorithm: z.literal("ed25519"),
  publicKeyBytes: CanonicalPublicKeyBytes32V1Schema,
  publicKeyDigest: Ed25519PublicKeyDigestV1Schema,
} as const;

export const ProviderFeasibilityApproverPublicKeyUnsignedClaimsV1Schema =
  z.strictObject(feasibilityApproverPublicKeyUnsignedShapeV1);
export type ProviderFeasibilityApproverPublicKeyUnsignedClaimsV1 = z.infer<
  typeof ProviderFeasibilityApproverPublicKeyUnsignedClaimsV1Schema
>;

export const ProviderFeasibilityApproverPublicKeyV1Schema = z.strictObject({
  ...feasibilityApproverPublicKeyUnsignedShapeV1,
  registrySignature: StoreProviderRegistrySignatureV1Schema,
});
export type ProviderFeasibilityApproverPublicKeyV1 = z.infer<
  typeof ProviderFeasibilityApproverPublicKeyV1Schema
>;

export const ProviderFeasibilityEvidencePinV1Schema = z.strictObject({
  locatorProfile: z.literal("installation_provider_feasibility_evidence_v1"),
  evidenceId: ProviderFeasibilityEvidenceIdV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderFeasibilityEvidencePinV1 = z.infer<
  typeof ProviderFeasibilityEvidencePinV1Schema
>;

export const ProviderFeasibilityApprovalKeysV1Schema = z.strictObject({
  profile: z.literal("provider_feasibility_approval_keys_v1"),
  activeKeyIds: z.strictObject({
    qa: ProviderFeasibilityApproverKeyIdV1Schema,
    release: ProviderFeasibilityApproverKeyIdV1Schema,
  }),
  publicKeyRecords: z
    .array(ProviderFeasibilityApproverPublicKeyV1Schema)
    .min(1)
    .superRefine((records, context) => {
      assertStrictlyIncreasingV1(
        records,
        (left, right) =>
          compareStringTupleV1(
            [left.role, left.keyId],
            [right.role, right.keyId],
          ),
        context,
        "approver public-key records must be sorted and unique by role/keyId",
      );
    }),
  compromisedRevokedKeyIds: z
    .array(ProviderFeasibilityApproverKeyIdV1Schema)
    .superRefine((keyIds, context) => {
      assertStrictlyIncreasingV1(
        keyIds,
        compareUtf8BytewiseV1,
        context,
        "revoked approver key IDs must be UTF-8 bytewise sorted and unique",
      );
    }),
});
export type ProviderFeasibilityApprovalKeysV1 = z.infer<
  typeof ProviderFeasibilityApprovalKeysV1Schema
>;

export const StoreDurableObjectProviderVerificationKeysV1Schema =
  z.strictObject({
    profile: z.literal("store_durable_object_provider_verification_keys_v1"),
    activeKeyIds: z.strictObject({
      operationReceipt: StoreProviderVerificationKeyIdV1Schema,
      containmentProof: StoreProviderVerificationKeyIdV1Schema,
      stateVersion: StoreProviderVerificationKeyIdV1Schema,
      journalVersion: StoreProviderVerificationKeyIdV1Schema,
      strongMutationAuthorityGrant:
        StoreProviderVerificationKeyIdV1Schema.optional(),
    }),
    activeBindingDerivationKeyGeneration: PositiveSafeIntegerV1Schema,
    publicKeyRecords: z
      .array(StoreDurableObjectProviderVerificationPublicKeyV1Schema)
      .min(1)
      .superRefine((records, context) => {
        assertStrictlyIncreasingV1(
          records,
          (left, right) =>
            compareStringTupleV1(
              [left.providerId, left.usage, left.keyId],
              [right.providerId, right.usage, right.keyId],
            ),
          context,
          "verification public-key records must be sorted and unique by providerId/usage/keyId",
        );
      }),
    bindingDerivationGenerationRecords: z
      .array(StoreDurableObjectProviderBindingDerivationGenerationV1Schema)
      .min(1)
      .superRefine((records, context) => {
        assertStrictlyIncreasingV1(
          records,
          (left, right) => {
            const providerOrder = compareUtf8BytewiseV1(
              left.providerId,
              right.providerId,
            );
            return providerOrder === 0
              ? left.generation - right.generation
              : providerOrder;
          },
          context,
          "binding derivation records must be sorted and unique by providerId/generation",
        );
      }),
    compromisedRevokedKeyIds: z
      .array(StoreProviderVerificationKeyIdV1Schema)
      .superRefine((keyIds, context) => {
        assertStrictlyIncreasingV1(
          keyIds,
          compareUtf8BytewiseV1,
          context,
          "revoked verification key IDs must be UTF-8 bytewise sorted and unique",
        );
      }),
    compromisedRevokedBindingDerivationGenerations: z
      .array(PositiveSafeIntegerV1Schema)
      .superRefine((generations, context) => {
        assertStrictlyIncreasingV1(
          generations,
          (left, right) => left - right,
          context,
          "revoked binding generations must be numerically sorted and unique",
        );
      }),
  });
export type StoreDurableObjectProviderVerificationKeysV1 = z.infer<
  typeof StoreDurableObjectProviderVerificationKeysV1Schema
>;

const registryEntryCommonUnsignedShapeV1 = {
  profile: z.literal("store_durable_object_provider_registry_entry_v1"),
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  registryRootKeyId: ProviderRegistryRootKeyIdV1Schema,
  providerId: DurableObjectIdentityProviderIdV1Schema,
  semanticProviderPolicyDigest: ContentDigestV1Schema,
  providerFeasibilityEvidence: ProviderFeasibilityEvidencePinV1Schema,
  runtimeAttestation:
    StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  verificationKeys: StoreDurableObjectProviderVerificationKeysV1Schema,
  feasibilityApprovalKeys: ProviderFeasibilityApprovalKeysV1Schema,
  status: z.literal("enabled"),
} as const;

export const StoreDurableObjectProviderRegistryEntryGenesisUnsignedClaimsV1Schema =
  z.strictObject({
    ...registryEntryCommonUnsignedShapeV1,
    registryGeneration: z.literal(1),
  });
export const StoreDurableObjectProviderRegistryEntrySuccessorUnsignedClaimsV1Schema =
  z.strictObject({
    ...registryEntryCommonUnsignedShapeV1,
    registryGeneration: SuccessorSafeIntegerV1Schema,
    predecessorRegistryEntryContentDigest: ContentDigestV1Schema,
  });
export const StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema =
  z.union([
    StoreDurableObjectProviderRegistryEntryGenesisUnsignedClaimsV1Schema,
    StoreDurableObjectProviderRegistryEntrySuccessorUnsignedClaimsV1Schema,
  ]);
export type StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1 = z.infer<
  typeof StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema
>;

export const StoreDurableObjectProviderRegistryEntryGenesisV1Schema =
  z.strictObject({
    ...registryEntryCommonUnsignedShapeV1,
    registryGeneration: z.literal(1),
    registrySignature: StoreProviderRegistrySignatureV1Schema,
  });
export const StoreDurableObjectProviderRegistryEntrySuccessorV1Schema =
  z.strictObject({
    ...registryEntryCommonUnsignedShapeV1,
    registryGeneration: SuccessorSafeIntegerV1Schema,
    predecessorRegistryEntryContentDigest: ContentDigestV1Schema,
    registrySignature: StoreProviderRegistrySignatureV1Schema,
  });
export const StoreDurableObjectProviderRegistryEntryV1Schema = z.union([
  StoreDurableObjectProviderRegistryEntryGenesisV1Schema,
  StoreDurableObjectProviderRegistryEntrySuccessorV1Schema,
]);
export type StoreDurableObjectProviderRegistryEntryV1 = z.infer<
  typeof StoreDurableObjectProviderRegistryEntryV1Schema
>;

export const ProviderRegistryManifestEnabledMemberV1Schema = z.strictObject({
  providerId: DurableObjectIdentityProviderIdV1Schema,
  disposition: z.literal("enabled"),
  registryEntryContentDigest: ContentDigestV1Schema,
  registryEntry: StoreDurableObjectProviderRegistryEntryV1Schema,
});
export const ProviderRegistryManifestRevokedMemberV1Schema = z.strictObject({
  providerId: DurableObjectIdentityProviderIdV1Schema,
  disposition: z.literal("revoked"),
  lastEnabledRegistryEntryContentDigest: ContentDigestV1Schema,
  revokedAtManifestGeneration: PositiveSafeIntegerV1Schema,
  reason: z.enum([
    "provider_compromised",
    "semantic_policy_retired",
    "distribution_support_withdrawn",
    "migration_completed",
  ]),
});
export const ProviderRegistryManifestMemberV1Schema = z.discriminatedUnion(
  "disposition",
  [
    ProviderRegistryManifestEnabledMemberV1Schema,
    ProviderRegistryManifestRevokedMemberV1Schema,
  ],
);
export type ProviderRegistryManifestMemberV1 = z.infer<
  typeof ProviderRegistryManifestMemberV1Schema
>;

const ProviderRegistryManifestMembersV1Schema = z
  .array(ProviderRegistryManifestMemberV1Schema)
  .min(1)
  .superRefine((members, context) => {
    assertStrictlyIncreasingV1(
      members,
      (left, right) => compareUtf8BytewiseV1(left.providerId, right.providerId),
      context,
      "manifest members must be UTF-8 bytewise sorted and unique by providerId",
    );
  });

export const ProviderRegistryManifestRoutingV1Schema = z.discriminatedUnion(
  "state",
  [
    z.strictObject({ state: z.literal("steady") }),
    z.strictObject({
      state: z.literal("migration"),
      migrationId: ProviderMigrationIdV1Schema,
      sourceProviderId: DurableObjectIdentityProviderIdV1Schema,
      destinationProviderId: DurableObjectIdentityProviderIdV1Schema,
      activeForMigrationWrites: DurableObjectIdentityProviderIdV1Schema,
      phase: z.enum(["prepared", "rebinding", "source_drained"]),
    }),
  ],
);
export type ProviderRegistryManifestRoutingV1 = z.infer<
  typeof ProviderRegistryManifestRoutingV1Schema
>;

export const ProviderRegistryManifestGenesisPredecessorV1Schema =
  z.strictObject({ state: z.literal("genesis") });
export const ProviderRegistryManifestSuccessorPredecessorV1Schema =
  z.strictObject({
    state: z.literal("manifest"),
    generationId: ProviderRegistryManifestGenerationIdV1Schema,
    contentDigest: ContentDigestV1Schema,
  });

const manifestCommonIdShapeV1 = {
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  members: ProviderRegistryManifestMembersV1Schema,
  routing: ProviderRegistryManifestRoutingV1Schema,
} as const;

export const ProviderRegistryManifestGenesisIdFieldsV1Schema = z.strictObject({
  ...manifestCommonIdShapeV1,
  manifestGeneration: z.literal(1),
  predecessor: ProviderRegistryManifestGenesisPredecessorV1Schema,
});
export const ProviderRegistryManifestSuccessorIdFieldsV1Schema =
  z.strictObject({
    ...manifestCommonIdShapeV1,
    manifestGeneration: SuccessorSafeIntegerV1Schema,
    predecessor: ProviderRegistryManifestSuccessorPredecessorV1Schema,
  });
export const ProviderRegistryManifestIdFieldsV1Schema = z.union([
  ProviderRegistryManifestGenesisIdFieldsV1Schema,
  ProviderRegistryManifestSuccessorIdFieldsV1Schema,
]);
export type ProviderRegistryManifestIdFieldsV1 = z.infer<
  typeof ProviderRegistryManifestIdFieldsV1Schema
>;

const manifestCommonUnsignedShapeV1 = {
  profile: z.literal("provider_registry_manifest_v1"),
  generationId: ProviderRegistryManifestGenerationIdV1Schema,
  ...manifestCommonIdShapeV1,
  issuedAt: ProviderRegistryIsoTimestampV1Schema,
} as const;

export const ProviderRegistryManifestGenesisUnsignedClaimsV1Schema =
  z.strictObject({
    ...manifestCommonUnsignedShapeV1,
    manifestGeneration: z.literal(1),
    predecessor: ProviderRegistryManifestGenesisPredecessorV1Schema,
  });
export const ProviderRegistryManifestSuccessorUnsignedClaimsV1Schema =
  z.strictObject({
    ...manifestCommonUnsignedShapeV1,
    manifestGeneration: SuccessorSafeIntegerV1Schema,
    predecessor: ProviderRegistryManifestSuccessorPredecessorV1Schema,
  });
export const ProviderRegistryManifestUnsignedClaimsV1Schema = z.union([
  ProviderRegistryManifestGenesisUnsignedClaimsV1Schema,
  ProviderRegistryManifestSuccessorUnsignedClaimsV1Schema,
]);
export type ProviderRegistryManifestUnsignedClaimsV1 = z.infer<
  typeof ProviderRegistryManifestUnsignedClaimsV1Schema
>;

export const ProviderRegistryManifestGenesisV1Schema = z.strictObject({
  ...manifestCommonUnsignedShapeV1,
  manifestGeneration: z.literal(1),
  predecessor: ProviderRegistryManifestGenesisPredecessorV1Schema,
  manifestSignature: ProviderRegistryManifestSignatureV1Schema,
});
export const ProviderRegistryManifestSuccessorV1Schema = z.strictObject({
  ...manifestCommonUnsignedShapeV1,
  manifestGeneration: SuccessorSafeIntegerV1Schema,
  predecessor: ProviderRegistryManifestSuccessorPredecessorV1Schema,
  manifestSignature: ProviderRegistryManifestSignatureV1Schema,
});
export const ProviderRegistryManifestV1Schema = z.union([
  ProviderRegistryManifestGenesisV1Schema,
  ProviderRegistryManifestSuccessorV1Schema,
]);
export type ProviderRegistryManifestV1 = z.infer<
  typeof ProviderRegistryManifestV1Schema
>;

export const ProviderRegistryManifestEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_registry_manifest"),
  generationId: ProviderRegistryManifestGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: ProviderRegistryManifestV1Schema,
});
export type ProviderRegistryManifestEnvelopeV1 = z.infer<
  typeof ProviderRegistryManifestEnvelopeV1Schema
>;

export const ProviderRegistryManifestPinV1Schema = z.strictObject({
  locatorProfile: z.literal("installation_provider_registry_manifest_v1"),
  manifestGeneration: PositiveSafeIntegerV1Schema,
  generationId: ProviderRegistryManifestGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderRegistryManifestPinV1 = z.infer<
  typeof ProviderRegistryManifestPinV1Schema
>;

function parseSignedOrUnsignedClaimsV1<T>(
  input: unknown,
  signedSchema: z.ZodType<T>,
  unsignedSchema: z.ZodType<T>,
  projectSigned: (signed: T) => unknown,
): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed = signedSchema.safeParse(input);
  if (signed.success) return unsignedSchema.parse(projectSigned(signed.data));
  return unsignedSchema.parse(input);
}

export function projectStoreProviderVerificationKeyIdFieldsV1(
  input: unknown,
): StoreProviderVerificationKeyIdFieldsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed =
    StoreDurableObjectProviderVerificationPublicKeyV1Schema.safeParse(input);
  if (signed.success) {
    return StoreProviderVerificationKeyIdFieldsV1Schema.parse({
      providerId: signed.data.providerId,
      usage: signed.data.usage,
      publicKeyBytes: signed.data.publicKeyBytes,
    });
  }
  const unsigned =
    StoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1Schema.safeParse(
      input,
    );
  if (unsigned.success) {
    return StoreProviderVerificationKeyIdFieldsV1Schema.parse({
      providerId: unsigned.data.providerId,
      usage: unsigned.data.usage,
      publicKeyBytes: unsigned.data.publicKeyBytes,
    });
  }
  return StoreProviderVerificationKeyIdFieldsV1Schema.parse(input);
}

export function projectProviderFeasibilityApproverKeyIdFieldsV1(
  input: unknown,
): ProviderFeasibilityApproverKeyIdFieldsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed = ProviderFeasibilityApproverPublicKeyV1Schema.safeParse(input);
  if (signed.success) {
    return ProviderFeasibilityApproverKeyIdFieldsV1Schema.parse({
      role: signed.data.role,
      publicKeyBytes: signed.data.publicKeyBytes,
    });
  }
  const unsigned =
    ProviderFeasibilityApproverPublicKeyUnsignedClaimsV1Schema.safeParse(input);
  if (unsigned.success) {
    return ProviderFeasibilityApproverKeyIdFieldsV1Schema.parse({
      role: unsigned.data.role,
      publicKeyBytes: unsigned.data.publicKeyBytes,
    });
  }
  return ProviderFeasibilityApproverKeyIdFieldsV1Schema.parse(input);
}

export function deriveStoreProviderVerificationKeyIdV1(
  input: unknown,
): StoreProviderVerificationKeyIdV1 {
  const fields = projectStoreProviderVerificationKeyIdFieldsV1(input);
  return StoreProviderVerificationKeyIdV1Schema.parse(
    shortHexForDomainV1(STORE_PROVIDER_VERIFICATION_KEY_ID_DOMAIN_V1, fields),
  );
}

export const deriveStoreDurableObjectProviderVerificationKeyIdV1 =
  deriveStoreProviderVerificationKeyIdV1;

export function deriveProviderFeasibilityApproverKeyIdV1(
  input: unknown,
): ProviderFeasibilityApproverKeyIdV1 {
  const fields = projectProviderFeasibilityApproverKeyIdFieldsV1(input);
  return ProviderFeasibilityApproverKeyIdV1Schema.parse(
    shortHexForDomainV1(
      PROVIDER_FEASIBILITY_APPROVER_KEY_ID_DOMAIN_V1,
      fields,
    ),
  );
}

export function validateStoreDurableObjectProviderVerificationPublicKeyStructureV1(
  input: unknown,
): StoreDurableObjectProviderVerificationPublicKeyV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const record =
    StoreDurableObjectProviderVerificationPublicKeyV1Schema.parse(input);
  const keyId = deriveStoreProviderVerificationKeyIdV1({
    providerId: record.providerId,
    usage: record.usage,
    publicKeyBytes: record.publicKeyBytes,
  });
  const publicKeyDigest = deriveProviderEd25519PublicKeyDigestInternalV1(
    record.publicKeyBytes,
  );
  if (record.keyId !== keyId || record.publicKeyDigest !== publicKeyDigest) {
    throw new TypeError("provider verification public-key material mismatch");
  }
  return record;
}

export function validateProviderFeasibilityApproverPublicKeyStructureV1(
  input: unknown,
): ProviderFeasibilityApproverPublicKeyV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const record = ProviderFeasibilityApproverPublicKeyV1Schema.parse(input);
  const keyId = deriveProviderFeasibilityApproverKeyIdV1({
    role: record.role,
    publicKeyBytes: record.publicKeyBytes,
  });
  const publicKeyDigest = deriveProviderEd25519PublicKeyDigestInternalV1(
    record.publicKeyBytes,
  );
  if (record.keyId !== keyId || record.publicKeyDigest !== publicKeyDigest) {
    throw new TypeError("feasibility approver public-key material mismatch");
  }
  return record;
}

export function projectStoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1(
  input: unknown,
): StoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1 {
  return parseSignedOrUnsignedClaimsV1(
    input,
    StoreDurableObjectProviderRuntimeAttestationV1Schema,
    StoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1Schema,
    (signed) => {
      const { registrySignature: _registrySignature, ...claims } =
        signed as StoreDurableObjectProviderRuntimeAttestationV1;
      return claims;
    },
  ) as StoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1;
}

export function deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    STORE_DURABLE_OBJECT_PROVIDER_RUNTIME_ATTESTATION_DOMAIN_V1,
    projectStoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1(input),
  );
}

export function projectStoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1(
  input: unknown,
): StoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1 {
  return parseSignedOrUnsignedClaimsV1(
    input,
    StoreDurableObjectProviderVerificationPublicKeyV1Schema,
    StoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1Schema,
    (signed) => {
      const { registrySignature: _registrySignature, ...claims } =
        signed as StoreDurableObjectProviderVerificationPublicKeyV1;
      return claims;
    },
  ) as StoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1;
}

export function projectStoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1(
  input: unknown,
): StoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1 {
  return parseSignedOrUnsignedClaimsV1(
    input,
    StoreDurableObjectProviderBindingDerivationGenerationV1Schema,
    StoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1Schema,
    (signed) => {
      const { registrySignature: _registrySignature, ...claims } =
        signed as StoreDurableObjectProviderBindingDerivationGenerationV1;
      return claims;
    },
  ) as StoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1;
}

export function projectProviderFeasibilityApproverPublicKeyUnsignedClaimsV1(
  input: unknown,
): ProviderFeasibilityApproverPublicKeyUnsignedClaimsV1 {
  return parseSignedOrUnsignedClaimsV1(
    input,
    ProviderFeasibilityApproverPublicKeyV1Schema,
    ProviderFeasibilityApproverPublicKeyUnsignedClaimsV1Schema,
    (signed) => {
      const { registrySignature: _registrySignature, ...claims } =
        signed as ProviderFeasibilityApproverPublicKeyV1;
      return claims;
    },
  ) as ProviderFeasibilityApproverPublicKeyUnsignedClaimsV1;
}

export function projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1(
  input: unknown,
): StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1 {
  return parseSignedOrUnsignedClaimsV1(
    input,
    StoreDurableObjectProviderRegistryEntryV1Schema,
    StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema,
    (signed) => {
      const { registrySignature: _registrySignature, ...claims } =
        signed as StoreDurableObjectProviderRegistryEntryV1;
      return claims;
    },
  ) as StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1;
}

export function deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_DOMAIN_V1,
    projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1(input),
  );
}

export function projectProviderRegistryManifestIdFieldsV1(
  input: unknown,
): ProviderRegistryManifestIdFieldsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const bareFields = ProviderRegistryManifestIdFieldsV1Schema.safeParse(input);
  if (bareFields.success) return bareFields.data;
  const signed = ProviderRegistryManifestV1Schema.safeParse(input);
  const manifest = signed.success
    ? signed.data
    : ProviderRegistryManifestUnsignedClaimsV1Schema.parse(input);
  return ProviderRegistryManifestIdFieldsV1Schema.parse({
    installationIdentityGenerationId:
      manifest.installationIdentityGenerationId,
    activeRootMetadata: manifest.activeRootMetadata,
    manifestGeneration: manifest.manifestGeneration,
    predecessor: manifest.predecessor,
    members: manifest.members,
    routing: manifest.routing,
  });
}

export function deriveProviderRegistryManifestGenerationIdV1(
  input: unknown,
): ProviderRegistryManifestGenerationIdV1 {
  const fields = projectProviderRegistryManifestIdFieldsV1(input);
  return ProviderRegistryManifestGenerationIdV1Schema.parse(
    `provider-registry-manifest:${shortHexForDomainV1(
      PROVIDER_REGISTRY_MANIFEST_ID_DOMAIN_V1,
      fields,
    )}`,
  );
}

export function projectProviderRegistryManifestUnsignedClaimsV1(
  input: unknown,
): ProviderRegistryManifestUnsignedClaimsV1 {
  return parseSignedOrUnsignedClaimsV1(
    input,
    ProviderRegistryManifestV1Schema,
    ProviderRegistryManifestUnsignedClaimsV1Schema,
    (signed) => {
      const { manifestSignature: _manifestSignature, ...claims } =
        signed as ProviderRegistryManifestV1;
      return claims;
    },
  ) as ProviderRegistryManifestUnsignedClaimsV1;
}

export function deriveProviderRegistryManifestContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REGISTRY_MANIFEST_DOMAIN_V1,
    projectProviderRegistryManifestUnsignedClaimsV1(input),
  );
}

export const StoreDurableObjectProviderRuntimeAttestationSignatureWrapperV1Schema =
  z.strictObject({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(STORE_PROVIDER_RUNTIME_ATTESTATION_SIGNATURE_DOMAIN_V1),
    claims:
      StoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1Schema,
  });
export type StoreDurableObjectProviderRuntimeAttestationSignatureWrapperV1 =
  z.infer<
    typeof StoreDurableObjectProviderRuntimeAttestationSignatureWrapperV1Schema
  >;

export const StoreDurableObjectProviderVerificationPublicKeySignatureWrapperV1Schema =
  z.strictObject({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(
      STORE_DURABLE_OBJECT_PROVIDER_VERIFICATION_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
    ),
    claims:
      StoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1Schema,
  });
export type StoreDurableObjectProviderVerificationPublicKeySignatureWrapperV1 =
  z.infer<
    typeof StoreDurableObjectProviderVerificationPublicKeySignatureWrapperV1Schema
  >;

export const StoreDurableObjectProviderBindingDerivationGenerationSignatureWrapperV1Schema =
  z.strictObject({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(
      STORE_DURABLE_OBJECT_PROVIDER_BINDING_DERIVATION_GENERATION_SIGNATURE_DOMAIN_V1,
    ),
    claims:
      StoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1Schema,
  });
export type StoreDurableObjectProviderBindingDerivationGenerationSignatureWrapperV1 =
  z.infer<
    typeof StoreDurableObjectProviderBindingDerivationGenerationSignatureWrapperV1Schema
  >;

export const ProviderFeasibilityApproverPublicKeySignatureWrapperV1Schema =
  z.strictObject({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(
      PROVIDER_FEASIBILITY_APPROVER_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
    ),
    claims: ProviderFeasibilityApproverPublicKeyUnsignedClaimsV1Schema,
  });
export type ProviderFeasibilityApproverPublicKeySignatureWrapperV1 = z.infer<
  typeof ProviderFeasibilityApproverPublicKeySignatureWrapperV1Schema
>;

export const StoreDurableObjectProviderRegistryEntrySignatureWrapperV1Schema =
  z.strictObject({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(
      STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_SIGNATURE_DOMAIN_V1,
    ),
    claims: StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema,
  });
export type StoreDurableObjectProviderRegistryEntrySignatureWrapperV1 =
  z.infer<
    typeof StoreDurableObjectProviderRegistryEntrySignatureWrapperV1Schema
  >;

export const ProviderRegistryManifestSignatureWrapperV1Schema = z.strictObject(
  {
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(PROVIDER_REGISTRY_MANIFEST_SIGNATURE_DOMAIN_V1),
    claims: ProviderRegistryManifestUnsignedClaimsV1Schema,
  },
);
export type ProviderRegistryManifestSignatureWrapperV1 = z.infer<
  typeof ProviderRegistryManifestSignatureWrapperV1Schema
>;

function createRegistryRootSignatureMessageV1(
  domain: string,
  wrapper: object,
): Uint8Array {
  return canonicalizeJcsSafeIntegerUtf8V1([domain, wrapper]);
}

function rootKeyIdFromRegistrySignatureV1(input: unknown): string | undefined {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const descriptors = objectGetOwnPropertyDescriptorsV1(input as object);
  const signature = descriptors.registrySignature?.value;
  const match =
    typeof signature === "string"
      ? regExpExecV1(
          /^provider-registry-ed25519:([0-9a-f]{22}):[0-9a-f]{128}$/u,
          signature,
        )
      : null;
  return match?.[1];
}

function rootKeyIdFromManifestSignatureV1(input: unknown): string | undefined {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const descriptors = objectGetOwnPropertyDescriptorsV1(input as object);
  const signature = descriptors.manifestSignature?.value;
  const match =
    typeof signature === "string"
      ? regExpExecV1(
          /^provider-registry-manifest-ed25519:([0-9a-f]{22}):[0-9a-f]{128}$/u,
          signature,
        )
      : null;
  return match?.[1];
}

function resolveRegistryRootKeyIdV1(
  input: unknown,
  rootKeyId: unknown,
): ReturnType<typeof ProviderRegistryRootKeyIdV1Schema.parse> {
  const signedRootKeyId = rootKeyIdFromRegistrySignatureV1(input);
  const requestedRootKeyId =
    rootKeyId === undefined
      ? undefined
      : ProviderRegistryRootKeyIdV1Schema.parse(rootKeyId);
  if (
    signedRootKeyId !== undefined &&
    requestedRootKeyId !== undefined &&
    signedRootKeyId !== requestedRootKeyId
  ) {
    throw new TypeError("registry signature root key ID mismatch");
  }
  if (signedRootKeyId === undefined && requestedRootKeyId === undefined) {
    throw new TypeError("rootKeyId is required for unsigned registry claims");
  }
  return ProviderRegistryRootKeyIdV1Schema.parse(
    signedRootKeyId ?? requestedRootKeyId,
  );
}

export function createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
  input: unknown,
  rootKeyId?: unknown,
): Uint8Array {
  const wrapper =
    StoreDurableObjectProviderRuntimeAttestationSignatureWrapperV1Schema.parse({
      rootKeyId: resolveRegistryRootKeyIdV1(input, rootKeyId),
      domain: STORE_PROVIDER_RUNTIME_ATTESTATION_SIGNATURE_DOMAIN_V1,
      claims:
        projectStoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1(
          input,
        ),
    });
  return createRegistryRootSignatureMessageV1(
    STORE_PROVIDER_RUNTIME_ATTESTATION_SIGNATURE_DOMAIN_V1,
    wrapper,
  );
}

export function createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(
  input: unknown,
  rootKeyId?: unknown,
): Uint8Array {
  const wrapper =
    StoreDurableObjectProviderVerificationPublicKeySignatureWrapperV1Schema.parse(
      {
        rootKeyId: resolveRegistryRootKeyIdV1(input, rootKeyId),
        domain:
          STORE_DURABLE_OBJECT_PROVIDER_VERIFICATION_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
        claims:
          projectStoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1(
            input,
          ),
      },
    );
  return createRegistryRootSignatureMessageV1(
    STORE_DURABLE_OBJECT_PROVIDER_VERIFICATION_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
    wrapper,
  );
}

export function createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1(
  input: unknown,
  rootKeyId?: unknown,
): Uint8Array {
  const wrapper =
    StoreDurableObjectProviderBindingDerivationGenerationSignatureWrapperV1Schema.parse(
      {
        rootKeyId: resolveRegistryRootKeyIdV1(input, rootKeyId),
        domain:
          STORE_DURABLE_OBJECT_PROVIDER_BINDING_DERIVATION_GENERATION_SIGNATURE_DOMAIN_V1,
        claims:
          projectStoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1(
            input,
          ),
      },
    );
  return createRegistryRootSignatureMessageV1(
    STORE_DURABLE_OBJECT_PROVIDER_BINDING_DERIVATION_GENERATION_SIGNATURE_DOMAIN_V1,
    wrapper,
  );
}

export function createProviderFeasibilityApproverPublicKeySignatureMessageV1(
  input: unknown,
  rootKeyId?: unknown,
): Uint8Array {
  const wrapper =
    ProviderFeasibilityApproverPublicKeySignatureWrapperV1Schema.parse({
      rootKeyId: resolveRegistryRootKeyIdV1(input, rootKeyId),
      domain: PROVIDER_FEASIBILITY_APPROVER_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
      claims: projectProviderFeasibilityApproverPublicKeyUnsignedClaimsV1(
        input,
      ),
    });
  return createRegistryRootSignatureMessageV1(
    PROVIDER_FEASIBILITY_APPROVER_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
    wrapper,
  );
}

export function createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
  input: unknown,
  rootKeyId?: unknown,
): Uint8Array {
  const wrapper =
    StoreDurableObjectProviderRegistryEntrySignatureWrapperV1Schema.parse({
      rootKeyId: resolveRegistryRootKeyIdV1(input, rootKeyId),
      domain:
        STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_SIGNATURE_DOMAIN_V1,
      claims: projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1(
        input,
      ),
    });
  return createRegistryRootSignatureMessageV1(
    STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_SIGNATURE_DOMAIN_V1,
    wrapper,
  );
}

export function createProviderRegistryManifestSignatureMessageV1(
  input: unknown,
  rootKeyId?: unknown,
): Uint8Array {
  const signedRootKeyId = rootKeyIdFromManifestSignatureV1(input);
  const requestedRootKeyId =
    rootKeyId === undefined
      ? undefined
      : ProviderRegistryRootKeyIdV1Schema.parse(rootKeyId);
  if (
    signedRootKeyId !== undefined &&
    requestedRootKeyId !== undefined &&
    signedRootKeyId !== requestedRootKeyId
  ) {
    throw new TypeError("manifest signature root key ID mismatch");
  }
  if (signedRootKeyId === undefined && requestedRootKeyId === undefined) {
    throw new TypeError("rootKeyId is required for unsigned manifest claims");
  }
  const wrapper = ProviderRegistryManifestSignatureWrapperV1Schema.parse({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema.parse(
      signedRootKeyId ?? requestedRootKeyId,
    ),
    domain: PROVIDER_REGISTRY_MANIFEST_SIGNATURE_DOMAIN_V1,
    claims: projectProviderRegistryManifestUnsignedClaimsV1(input),
  });
  return createRegistryRootSignatureMessageV1(
    PROVIDER_REGISTRY_MANIFEST_SIGNATURE_DOMAIN_V1,
    wrapper,
  );
}
