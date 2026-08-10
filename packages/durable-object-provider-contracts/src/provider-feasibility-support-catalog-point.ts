import { z } from "./zod-runtime.js";

import {
  ProviderBootstrapTrustBundleV1Schema,
  deriveProviderBootstrapTrustBundleContentDigestV1,
  type ProviderBootstrapTrustBundleV1,
} from "./bootstrap-trust-bundle.js";
import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  ProviderFilesystemProfileCodeV1Schema,
  ProviderOsReleaseFamilyCodeV1Schema,
  ProviderPublicSupportProfileIdV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
} from "./primitives.js";
import {
  encodeStoreFilenameKeyV1,
  type StoreFilenameKeyV1,
} from "./provider-fixed-locator.js";
import {
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  type ProviderFeasibilityEvidenceEnvelopeV1,
  type ProviderFeasibilityEvidencePointClosureValidationV1,
  type ValidateProviderFeasibilityEvidencePointClosureV1Input,
} from "./provider-feasibility-evidence-point.js";
import {
  parseProviderFeasibilityEvidenceSignatureBindingInternalV1,
} from "./provider-feasibility-evidence-point-internal.js";
import {
  diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1,
  registerProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1,
} from "./provider-feasibility-evidence-point-prepared-internal.js";
import {
  captureProviderPointDetachedExactDataObjectV1,
  captureProviderPointRawExactTopLevelV1,
  cloneProviderPointRawAdmissionCapsuleV1,
  createProviderPointRawAdmissionBudgetForSessionV1,
  createProviderPointRawAdmissionSessionV1,
  deepFreezeProviderPointDetachedDataTreeV1,
  walkProviderPointRawJsonIdentityTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
  type ProviderRealFilesystemConformanceResultEnvelopeV1,
} from "./provider-real-filesystem-conformance-result.js";
import type {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
  ProviderRealFilesystemSuiteManifestEnvelopeV1,
} from "./provider-real-filesystem-source.js";
import {
  ProviderBootstrapTrustBundlePinV1Schema,
  ProviderSignedDistributionRootBindingV1Schema,
  type ProviderSignedDistributionRootBindingV1,
} from "./provider-distribution-trust.js";
import {
  type ProviderRegistryManifestHistoryValidationV1,
  type ValidateProviderRegistryManifestHistoryV1Input,
} from "./provider-registry-manifest-history.js";
import "./provider-registry-history-prepared-internal.js";
import {
  createPreparedRegistryHistorySnapshotInternalV1,
  discardPreparedRegistryHistoryInputInternalV1,
  discardRegistryHistoryVerifiedWitnessInternalV1,
  diagnoseProviderRegistryManifestHistoryPreparedInternalV1,
  registerPreparedRegistryHistoryInputInternalV1,
  takeRegistryHistoryVerifiedWitnessInternalV1,
  type PreparedRegistryHistoryInputHandleV1,
  type RegistryHistoryVerifiedCryptoWitnessV1,
  type RegistryHistoryVerifiedTipEntryV1,
  type RegistryTrustWitnessHandleV1,
} from "./provider-registry-history-prepared-handle-internal.js";
import {
  ProviderFeasibilityApprovalKeysV1Schema,
  ProviderFeasibilityEvidencePinV1Schema,
  StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  type ProviderFeasibilityApproverPublicKeyV1,
  type ProviderFeasibilityApprovalKeysV1,
  type ProviderFeasibilityEvidencePinV1,
  type ProviderRegistryManifestEnvelopeV1,
} from "./provider-registry-records.js";
import {
  ProviderRegistryRootMetadataPinV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
  type ProviderRegistryRootMetadataEnvelopeV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import {
  diagnoseProviderReleaseTargetUniversePointPreparedInternalV1,
} from "./provider-release-target-universe-point-prepared-internal.js";
import {
  ProviderReleaseTargetUniverseEnvelopeV1Schema,
  ProviderReleaseTargetUniversePinV1Schema,
  type ProviderReleaseTargetUniverseEnvelopeV1,
  type ProviderReleaseTargetUniversePointClosureValidationV1,
  type ValidateProviderReleaseTargetUniversePointClosureV1Input,
} from "./provider-release-target-universe-point.js";
import {
  StoreDurableObjectProviderPolicyV1Schema,
  deriveStoreDurableObjectProviderPolicyDigestV1,
  type StoreDurableObjectProviderPolicyV1,
} from "./provider-runtime-attestation-point.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  deriveProviderPublicSupportProfileIdV1,
  deriveProviderTargetProfileIdV1,
  ProviderFeasibilityTargetV1Schema,
  ProviderPublicSupportTaxonomyPinV1Schema,
  type ProviderFeasibilityTargetV1,
  type ProviderPublicSupportTaxonomyEnvelopeV1,
  type ProviderReleaseMatrixEnvelopeV1,
  type ProviderTargetDiscoveryFixtureManifestEnvelopeV1,
  type ProviderTargetDiscoveryResultEnvelopeV1,
  type ProviderTargetDiscoveryRunnerRunEnvelopeV1,
} from "./provider-target-discovery-point.js";
import {
  assertProviderStrictEd25519CryptoCapabilityIdentityV1,
} from "./strict-ed25519-capability-internal.js";
import {
  ProviderStrictEd25519AttestationError,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedNumberParseIntV1 = Number.parseInt;
const CapturedNumberPrototypeToStringV1 = Number.prototype.toString;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedStringPrototypeIndexOfV1 = String.prototype.indexOf;
const CapturedStringPrototypePadStartV1 = String.prototype.padStart;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = CapturedWeakSetV1.prototype.add;
const CapturedWeakSetPrototypeHasV1 = CapturedWeakSetV1.prototype.has;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

function bindUncurriedCatalogIntrinsicV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const numberToStringV1 = bindUncurriedCatalogIntrinsicV1(
  CapturedNumberPrototypeToStringV1,
) as (receiver: number, radix?: number) => string;
const stringPadStartV1 = bindUncurriedCatalogIntrinsicV1(
  CapturedStringPrototypePadStartV1,
) as (receiver: string, length: number, fill?: string) => string;
const stringIndexOfV1 = bindUncurriedCatalogIntrinsicV1(
  CapturedStringPrototypeIndexOfV1,
) as (receiver: string, search: string, position?: number) => number;
const stringSliceV1 = bindUncurriedCatalogIntrinsicV1(
  CapturedStringPrototypeSliceV1,
) as (receiver: string, start?: number, end?: number) => string;
const regExpExecV1 = bindUncurriedCatalogIntrinsicV1(
  CapturedRegExpPrototypeExecV1,
) as (receiver: RegExp, value: string) => RegExpExecArray | null;
const textEncoderEncodeV1 = bindUncurriedCatalogIntrinsicV1(
  CapturedTextEncoderPrototypeEncodeV1,
) as (receiver: TextEncoder, value?: string) => Uint8Array;
const weakSetAddV1 = bindUncurriedCatalogIntrinsicV1(
  CapturedWeakSetPrototypeAddV1,
) as <T extends object>(receiver: WeakSet<T>, value: T) => WeakSet<T>;
const weakSetHasV1 = bindUncurriedCatalogIntrinsicV1(
  CapturedWeakSetPrototypeHasV1,
) as <T extends object>(receiver: WeakSet<T>, value: T) => boolean;

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_DOMAIN_V1 =
  "provider-feasibility-support-catalog-v1" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_SIGNATURE_DOMAIN_V1 =
  "provider-feasibility-support-catalog-signature-v1" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_LOCATOR_PROFILE_V1 =
  "distribution_provider_feasibility_support_catalog_v1" as const;
export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1 =
  "none_provider_feasibility_support_catalog_structure_only" as const;

export const ProviderFeasibilityReleaseDispositionV1Schema = z.enum([
  "strong_read_write",
  "legacy_redacted_read_only",
]);
export type ProviderFeasibilityReleaseDispositionV1 = z.infer<
  typeof ProviderFeasibilityReleaseDispositionV1Schema
>;

export const ProviderFeasibilitySupportCatalogSignatureV1Schema = z
  .string()
  .regex(
    /^provider-support-catalog-ed25519:[0-9a-f]{22}:[0-9a-f]{128}$/u,
  )
  .brand<"ProviderFeasibilitySupportCatalogSignatureV1">();
export type ProviderFeasibilitySupportCatalogSignatureV1 = z.infer<
  typeof ProviderFeasibilitySupportCatalogSignatureV1Schema
>;

export const ProviderFeasibilitySupportCandidateV1Schema = z.strictObject({
  providerId: DurableObjectIdentityProviderIdV1Schema,
  providerFeasibilityEvidence: ProviderFeasibilityEvidencePinV1Schema,
  semanticProviderPolicy: StoreDurableObjectProviderPolicyV1Schema,
  runtimeAttestation:
    StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  releaseDisposition: ProviderFeasibilityReleaseDispositionV1Schema,
});
export type ProviderFeasibilitySupportCandidateV1 = z.infer<
  typeof ProviderFeasibilitySupportCandidateV1Schema
>;

export const ProviderFeasibilitySupportTargetEntryV1Schema = z.strictObject({
  target: ProviderFeasibilityTargetV1Schema,
  candidates: z.array(ProviderFeasibilitySupportCandidateV1Schema).min(1),
});
export type ProviderFeasibilitySupportTargetEntryV1 = z.infer<
  typeof ProviderFeasibilitySupportTargetEntryV1Schema
>;

const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

const CatalogUnsignedShapeV1 = {
  profile: z.literal("provider_feasibility_support_catalog_v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  registryRootKeyId: ProviderRegistryRootKeyIdV1Schema,
  catalogGeneration: PositiveSafeIntegerV1Schema,
  predecessorCatalogContentDigest: ContentDigestV1Schema.optional(),
  feasibilityApprovalKeys: ProviderFeasibilityApprovalKeysV1Schema,
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1Schema,
  releaseTargetUniverse: ProviderReleaseTargetUniversePinV1Schema,
  targets: z
    .array(ProviderFeasibilitySupportTargetEntryV1Schema)
    .min(1)
    .max(4096),
} as const;

export const ProviderFeasibilitySupportCatalogUnsignedClaimsV1Schema =
  z.strictObject(CatalogUnsignedShapeV1);
export type ProviderFeasibilitySupportCatalogUnsignedClaimsV1 = z.infer<
  typeof ProviderFeasibilitySupportCatalogUnsignedClaimsV1Schema
>;

export const ProviderFeasibilitySupportCatalogV1Schema = z.strictObject({
  ...CatalogUnsignedShapeV1,
  catalogSignature: ProviderFeasibilitySupportCatalogSignatureV1Schema,
});
export type ProviderFeasibilitySupportCatalogV1 = z.infer<
  typeof ProviderFeasibilitySupportCatalogV1Schema
>;

export const ProviderFeasibilitySupportCatalogEnvelopeV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal("provider_feasibility_support_catalog"),
    catalogGeneration: PositiveSafeIntegerV1Schema,
    contentDigest: ContentDigestV1Schema,
    payload: ProviderFeasibilitySupportCatalogV1Schema,
  });
export type ProviderFeasibilitySupportCatalogEnvelopeV1 = z.infer<
  typeof ProviderFeasibilitySupportCatalogEnvelopeV1Schema
>;

export const ProviderFeasibilitySupportCatalogPinV1Schema = z.strictObject({
  locatorProfile: z.literal(
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_LOCATOR_PROFILE_V1,
  ),
  catalogGeneration: PositiveSafeIntegerV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderFeasibilitySupportCatalogPinV1 = z.infer<
  typeof ProviderFeasibilitySupportCatalogPinV1Schema
>;

export const ProviderFeasibilityPublicSupportV1Schema = z.strictObject({
  profile: z.literal("provider_feasibility_public_support_v1"),
  publicProfileId: ProviderPublicSupportProfileIdV1Schema,
  osPlatform: z.enum(["darwin", "linux"]),
  osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1Schema,
  architecture: z.enum(["arm64", "x86_64"]),
  filesystemProfileCode: ProviderFilesystemProfileCodeV1Schema,
  capability: ProviderFeasibilityReleaseDispositionV1Schema,
});
export type ProviderFeasibilityPublicSupportV1 = z.infer<
  typeof ProviderFeasibilityPublicSupportV1Schema
>;

export const ProviderFeasibilitySupportCatalogSignatureWrapperV1Schema =
  z.strictObject({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_SIGNATURE_DOMAIN_V1,
    ),
    claims: ProviderFeasibilitySupportCatalogUnsignedClaimsV1Schema,
  });

export const ProviderFeasibilitySupportCandidateArtifactV1Schema =
  z.strictObject({
    providerFeasibilityEvidence:
      ProviderFeasibilityEvidenceEnvelopeV1Schema,
    realFilesystemConformanceResult:
      ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  });
export type ProviderFeasibilitySupportCandidateArtifactV1 = z.infer<
  typeof ProviderFeasibilitySupportCandidateArtifactV1Schema
>;

export type ProviderFeasibilitySupportCatalogRelativePathV1 =
  `provider/support-catalog/${StoreFilenameKeyV1}.json`;

export const ProviderFeasibilitySupportCatalogPointInvalidStageV1Schema =
  z.enum([
    "input",
    "bootstrap_distribution_binding",
    "registry_history_closure",
    "release_target_universe_closure",
    "catalog_structure",
    "candidate_artifacts_structure",
    "catalog_generation",
    "catalog_distribution_binding",
    "catalog_active_root",
    "catalog_approval_keys_binding",
    "catalog_taxonomy_pin",
    "catalog_universe_pin",
    "catalog_target_identity",
    "catalog_target_order",
    "catalog_candidate_order",
    "catalog_target_exact_cover",
    "catalog_candidate_binding",
    "candidate_deep_closure",
    "catalog_release_disposition",
    "catalog_signature_binding",
    "catalog_signature",
    "catalog_digest",
    "catalog_envelope",
    "catalog_pin",
  ]);
export type ProviderFeasibilitySupportCatalogPointInvalidStageV1 = z.infer<
  typeof ProviderFeasibilitySupportCatalogPointInvalidStageV1Schema
>;

export const ProviderFeasibilitySupportCatalogPointInvalidReasonV1Schema =
  z.enum([
    "schema_invalid",
    "source_invalid",
    "identity_mismatch",
    "binding_mismatch",
    "pin_mismatch",
    "root_mismatch",
    "count_mismatch",
    "digest_mismatch",
    "ordering_invalid",
    "coverage_mismatch",
    "result_not_passed",
    "signature_invalid",
    "envelope_mismatch",
  ]);
export type ProviderFeasibilitySupportCatalogPointInvalidReasonV1 = z.infer<
  typeof ProviderFeasibilitySupportCatalogPointInvalidReasonV1Schema
>;

export interface ValidateProviderFeasibilitySupportCatalogPointClosureV1Input {
  readonly activeRoot: ProviderRegistryRootPublicKeyV1;
  readonly activeRootMetadata: z.infer<
    typeof ProviderRegistryRootMetadataPinV1Schema
  >;
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly distributionRootBinding: ProviderSignedDistributionRootBindingV1;
  readonly fixtureCorpusManifest:
    ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly providerFeasibilitySupportCandidateArtifacts:
    readonly ProviderFeasibilitySupportCandidateArtifactV1[];
  readonly providerFeasibilitySupportCatalog:
    ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly publicSupportTaxonomy: ProviderPublicSupportTaxonomyEnvelopeV1;
  readonly registryManifestHistory:
    readonly ProviderRegistryManifestEnvelopeV1[];
  readonly releaseMatrix: ProviderReleaseMatrixEnvelopeV1;
  readonly releaseTargetUniverse: ProviderReleaseTargetUniverseEnvelopeV1;
  readonly rootMetadataHistory:
    readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly strictCryptoCapability:
    ProviderStrictEd25519OpaqueCapabilityV1;
  readonly suiteManifest: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  readonly targetDiscoveryFixtureManifest:
    ProviderTargetDiscoveryFixtureManifestEnvelopeV1;
  readonly targetDiscoveryResult: ProviderTargetDiscoveryResultEnvelopeV1;
  readonly targetDiscoveryRunnerRun:
    ProviderTargetDiscoveryRunnerRunEnvelopeV1;
}

export interface ProviderFeasibilityOwnerTargetCapabilityV1 {
  readonly target: ProviderFeasibilityTargetV1;
  readonly capability: ProviderFeasibilityReleaseDispositionV1;
}

export interface ProviderFeasibilitySupportCatalogCandidateClosureV1 {
  readonly catalogTarget: ProviderFeasibilityTargetV1;
  readonly catalogCandidate: ProviderFeasibilitySupportCandidateV1;
  readonly evidencePointClosure:
    ProviderFeasibilityEvidencePointClosureValidationV1;
}

export interface ProviderFeasibilitySupportCatalogPointClosureValidationV1 {
  readonly authority: typeof PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1;
  readonly registryManifestHistoryClosure:
    ProviderRegistryManifestHistoryValidationV1;
  readonly releaseTargetUniversePointClosure:
    ProviderReleaseTargetUniversePointClosureValidationV1;
  readonly candidateDeepClosures:
    readonly ProviderFeasibilitySupportCatalogCandidateClosureV1[];
  readonly ownerTargetCapabilities:
    readonly ProviderFeasibilityOwnerTargetCapabilityV1[];
  readonly publicSupport: readonly ProviderFeasibilityPublicSupportV1[];
  readonly providerFeasibilitySupportCatalog:
    ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly providerFeasibilitySupportCatalogPin:
    ProviderFeasibilitySupportCatalogPinV1;
  readonly relativePath: ProviderFeasibilitySupportCatalogRelativePathV1;
  readonly targetCount: number;
  readonly candidateCount: number;
  readonly publicSupportRowCount: number;
}

interface CatalogDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderFeasibilitySupportCatalogPointInvalidStageV1;
  readonly reason: ProviderFeasibilitySupportCatalogPointInvalidReasonV1;
}

interface CatalogDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderFeasibilitySupportCatalogPointClosureValidationV1;
}

export type ProviderFeasibilitySupportCatalogPointClosureDiagnosticResultV1 =
  | CatalogDiagnosticFailureV1
  | CatalogDiagnosticSuccessV1;

export class ProviderFeasibilitySupportCatalogPointClosureValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider feasibility support Catalog point validation failed");
    this.name =
      "ProviderFeasibilitySupportCatalogPointClosureValidationError";
    CapturedObjectFreezeV1(this);
  }
}

class CatalogDiagnosticSignalV1 extends Error {
  constructor(
    readonly stage: ProviderFeasibilitySupportCatalogPointInvalidStageV1,
    readonly reason: ProviderFeasibilitySupportCatalogPointInvalidReasonV1,
  ) {
    super("provider feasibility support Catalog diagnostic");
    weakSetAddV1(CatalogDiagnosticSignalsV1, this);
  }
}

const CatalogDiagnosticSignalsV1 = new CapturedWeakSetV1<object>();

function isCatalogDiagnosticSignalV1(
  value: unknown,
): value is CatalogDiagnosticSignalV1 {
  return typeof value === "object" && value !== null &&
    weakSetHasV1(CatalogDiagnosticSignalsV1, value);
}

function failCatalogV1(
  stage: ProviderFeasibilitySupportCatalogPointInvalidStageV1,
  reason: ProviderFeasibilitySupportCatalogPointInvalidReasonV1,
): never {
  throw new CatalogDiagnosticSignalV1(stage, reason);
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    output += stringPadStartV1(numberToStringV1(bytes[index]!, 16), 2, "0");
  }
  return output;
}

function lowerHexToBytesV1(hex: string): Uint8Array {
  const bytes = new CapturedUint8ArrayV1(hex.length / 2);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = CapturedNumberParseIntV1(
      stringSliceV1(hex, index * 2, index * 2 + 2),
      16,
    );
  }
  return bytes;
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  if (stringSliceV1(value, 0, "base64url:".length) !== "base64url:") {
    throw new CapturedTypeErrorV1("active root public key is not canonical");
  }
  const encoded = stringSliceV1(value, "base64url:".length);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  if (encoded.length !== 43) {
    throw new CapturedTypeErrorV1("active root public key length is invalid");
  }
  const bytes = new CapturedUint8ArrayV1(32);
  let buffer = 0;
  let bitCount = 0;
  let outputIndex = 0;
  for (let index = 0; index < encoded.length; index += 1) {
    const valueIndex = stringIndexOfV1(alphabet, encoded[index]!);
    if (valueIndex < 0) {
      throw new CapturedTypeErrorV1("active root public key is invalid");
    }
    buffer = (buffer << 6) | valueIndex;
    bitCount += 6;
    while (bitCount >= 8 && outputIndex < bytes.length) {
      bitCount -= 8;
      bytes[outputIndex] = (buffer >>> bitCount) & 255;
      outputIndex += 1;
    }
  }
  if (outputIndex !== 32) {
    throw new CapturedTypeErrorV1("active root public key is invalid");
  }
  return bytes;
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
  const rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

function compareUtf8V1(left: string, right: string): number {
  const leftBytes = textEncoderEncodeV1(CapturedUtf8EncoderV1, left);
  const rightBytes = textEncoderEncodeV1(CapturedUtf8EncoderV1, right);
  const length =
    leftBytes.byteLength < rightBytes.byteLength
      ? leftBytes.byteLength
      : rightBytes.byteLength;
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.byteLength - rightBytes.byteLength;
}

export function projectProviderFeasibilitySupportCatalogUnsignedClaimsV1(
  input: unknown,
): ProviderFeasibilitySupportCatalogUnsignedClaimsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed = ProviderFeasibilitySupportCatalogV1Schema.safeParse(input);
  if (!signed.success) {
    return ProviderFeasibilitySupportCatalogUnsignedClaimsV1Schema.parse(
      input,
    );
  }
  const { catalogSignature: _catalogSignature, ...claims } = signed.data;
  return ProviderFeasibilitySupportCatalogUnsignedClaimsV1Schema.parse(
    claims,
  );
}

export function deriveProviderFeasibilitySupportCatalogContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_DOMAIN_V1,
    projectProviderFeasibilitySupportCatalogUnsignedClaimsV1(input),
  );
}

const CATALOG_SIGNATURE_PATTERN_V1 =
  /^provider-support-catalog-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;

export function createProviderFeasibilitySupportCatalogSignatureMessageV1(
  input: unknown,
  rootKeyId?: unknown,
): Uint8Array {
  const claims = projectProviderFeasibilitySupportCatalogUnsignedClaimsV1(
    input,
  );
  const signed = ProviderFeasibilitySupportCatalogV1Schema.safeParse(input);
  const match = signed.success
    ? regExpExecV1(CATALOG_SIGNATURE_PATTERN_V1, signed.data.catalogSignature)
    : null;
  const signatureRootKeyId = match?.[1];
  const requestedRootKeyId =
    rootKeyId === undefined
      ? undefined
      : ProviderRegistryRootKeyIdV1Schema.parse(rootKeyId);
  if (
    signatureRootKeyId !== undefined &&
    requestedRootKeyId !== undefined &&
    signatureRootKeyId !== requestedRootKeyId
  ) {
    throw new CapturedTypeErrorV1("Catalog signature root key mismatch");
  }
  const resolvedRootKeyId = ProviderRegistryRootKeyIdV1Schema.parse(
    signatureRootKeyId ?? requestedRootKeyId,
  );
  const wrapper = ProviderFeasibilitySupportCatalogSignatureWrapperV1Schema.parse(
    {
      rootKeyId: resolvedRootKeyId,
      domain: PROVIDER_FEASIBILITY_SUPPORT_CATALOG_SIGNATURE_DOMAIN_V1,
      claims,
    },
  );
  return canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_SIGNATURE_DOMAIN_V1,
    wrapper,
  ]);
}

export function deriveProviderFeasibilitySupportCatalogPinV1(
  input: unknown,
): ProviderFeasibilitySupportCatalogPinV1 {
  const envelope = ProviderFeasibilitySupportCatalogEnvelopeV1Schema.parse(
    input,
  );
  if (
    envelope.catalogGeneration !== envelope.payload.catalogGeneration ||
    envelope.contentDigest !==
      deriveProviderFeasibilitySupportCatalogContentDigestV1(envelope.payload)
  ) {
    throw new CapturedTypeErrorV1("Catalog Envelope is not self-bound");
  }
  return ProviderFeasibilitySupportCatalogPinV1Schema.parse({
    locatorProfile:
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_LOCATOR_PROFILE_V1,
    catalogGeneration: envelope.catalogGeneration,
    contentDigest: envelope.contentDigest,
  });
}

export function buildProviderFeasibilitySupportCatalogRelativePathV1(
  input: unknown,
): ProviderFeasibilitySupportCatalogRelativePathV1 {
  const pin = ProviderFeasibilitySupportCatalogPinV1Schema.safeParse(input);
  const resolved = pin.success
    ? pin.data
    : deriveProviderFeasibilitySupportCatalogPinV1(input);
  const key = encodeStoreFilenameKeyV1(
    `catalog-generation:${resolved.catalogGeneration}`,
  );
  return `provider/support-catalog/${key}.json`;
}

const POINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "activeRoot",
  "activeRootMetadata",
  "bootstrapTrustBundle",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "installationIdentityGenerationId",
  "providerFeasibilitySupportCandidateArtifacts",
  "providerFeasibilitySupportCatalog",
  "publicSupportTaxonomy",
  "registryManifestHistory",
  "releaseMatrix",
  "releaseTargetUniverse",
  "rootMetadataHistory",
  "strictCryptoCapability",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const);
type PointInputKeyV1 = (typeof POINT_INPUT_KEYS_V1)[number];
type DetachedPointFieldsV1 = Record<PointInputKeyV1, unknown>;

const MAX_C09_1M_OBSERVED_IDENTITIES_V1 = 4_194_304;
const MAX_C09_1M_PRECLONE_WORK_UNITS_V1 = 268_435_456;
const MAX_C09_1M_DEPTH_V1 = 64;
const MAX_C09_1M_TRUST_BRANCH_UNITS_V1 = 4_194_304;
const MAX_C09_1M_DISTRIBUTION_BRANCH_UNITS_V1 = 16_777_216;
const MAX_C09_1M_AGGREGATE_BRANCH_UNITS_V1 = 268_435_456;

interface PreparedCatalogPointInputV1 {
  readonly fields: DetachedPointFieldsV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly registryRequest: ValidateProviderRegistryManifestHistoryV1Input;
  readonly registryInputHandle: PreparedRegistryHistoryInputHandleV1;
}

function branchLimitV1(key: PointInputKeyV1): number {
  if (
    key === "registryManifestHistory" ||
    key === "rootMetadataHistory" ||
    key === "providerFeasibilitySupportCandidateArtifacts"
  ) {
    return MAX_C09_1M_AGGREGATE_BRANCH_UNITS_V1;
  }
  if (key === "bootstrapTrustBundle") {
    return MAX_C09_1M_TRUST_BRANCH_UNITS_V1;
  }
  return MAX_C09_1M_DISTRIBUTION_BRANCH_UNITS_V1;
}

function prepareCatalogPointInputV1(input: unknown): PreparedCatalogPointInputV1 {
  const admission = createProviderPointRawAdmissionSessionV1(input, {
    maxObservedIdentities: MAX_C09_1M_OBSERVED_IDENTITIES_V1,
    maxPrecloneAllocationWorkUnits: MAX_C09_1M_PRECLONE_WORK_UNITS_V1,
  });
  const captured = captureProviderPointRawExactTopLevelV1(
    admission,
    POINT_INPUT_KEYS_V1,
  );
  const capability = captured.strictCryptoCapability;
  assertProviderStrictEd25519CryptoCapabilityIdentityV1(
    ProviderStrictEd25519AttestationError,
    capability,
  );
  for (let index = 0; index < POINT_INPUT_KEYS_V1.length; index += 1) {
    const key = POINT_INPUT_KEYS_V1[index]!;
    if (key === "strictCryptoCapability") continue;
    const value = captured[key];
    if (value === null || typeof value !== "object") {
      if (
        key !== "installationIdentityGenerationId" ||
        typeof value !== "string" ||
        value.length > MAX_C09_1M_DISTRIBUTION_BRANCH_UNITS_V1
      ) {
        throw new CapturedTypeErrorV1(
          "Catalog point JSON input branch is invalid",
        );
      }
      continue;
    }
    const limit = branchLimitV1(key);
    const budget = createProviderPointRawAdmissionBudgetForSessionV1(
      admission,
      MAX_C09_1M_DEPTH_V1,
      limit,
      limit,
      limit,
    );
    walkProviderPointRawJsonIdentityTreeV1(admission, value, budget);
  }
  const detached = captureProviderPointDetachedExactDataObjectV1(
    cloneProviderPointRawAdmissionCapsuleV1(admission),
    POINT_INPUT_KEYS_V1,
  );
  const fields = createProviderNonThenableFrozenRecordV1({
    activeRoot: deepFreezeProviderPointDetachedDataTreeV1(detached.activeRoot),
    activeRootMetadata: deepFreezeProviderPointDetachedDataTreeV1(
      detached.activeRootMetadata,
    ),
    bootstrapTrustBundle: deepFreezeProviderPointDetachedDataTreeV1(
      detached.bootstrapTrustBundle,
    ),
    distributionRootBinding: deepFreezeProviderPointDetachedDataTreeV1(
      detached.distributionRootBinding,
    ),
    fixtureCorpusManifest: deepFreezeProviderPointDetachedDataTreeV1(
      detached.fixtureCorpusManifest,
    ),
    installationIdentityGenerationId:
      detached.installationIdentityGenerationId,
    providerFeasibilitySupportCandidateArtifacts:
      deepFreezeProviderPointDetachedDataTreeV1(
        detached.providerFeasibilitySupportCandidateArtifacts,
      ),
    providerFeasibilitySupportCatalog:
      deepFreezeProviderPointDetachedDataTreeV1(
        detached.providerFeasibilitySupportCatalog,
      ),
    publicSupportTaxonomy: deepFreezeProviderPointDetachedDataTreeV1(
      detached.publicSupportTaxonomy,
    ),
    registryManifestHistory: deepFreezeProviderPointDetachedDataTreeV1(
      detached.registryManifestHistory,
    ),
    releaseMatrix: deepFreezeProviderPointDetachedDataTreeV1(
      detached.releaseMatrix,
    ),
    releaseTargetUniverse: deepFreezeProviderPointDetachedDataTreeV1(
      detached.releaseTargetUniverse,
    ),
    rootMetadataHistory: deepFreezeProviderPointDetachedDataTreeV1(
      detached.rootMetadataHistory,
    ),
    strictCryptoCapability:
      capability as ProviderStrictEd25519OpaqueCapabilityV1,
    suiteManifest: deepFreezeProviderPointDetachedDataTreeV1(
      detached.suiteManifest,
    ),
    targetDiscoveryFixtureManifest:
      deepFreezeProviderPointDetachedDataTreeV1(
        detached.targetDiscoveryFixtureManifest,
      ),
    targetDiscoveryResult: deepFreezeProviderPointDetachedDataTreeV1(
      detached.targetDiscoveryResult,
    ),
    targetDiscoveryRunnerRun: deepFreezeProviderPointDetachedDataTreeV1(
      detached.targetDiscoveryRunnerRun,
    ),
  }) as unknown as DetachedPointFieldsV1;
  const registryRequest = createProviderNonThenableFrozenRecordV1({
    bootstrapTrustBundle:
      fields.bootstrapTrustBundle as ProviderBootstrapTrustBundleV1,
    installationIdentityGenerationId:
      fields.installationIdentityGenerationId as InstallationIdentityGenerationIdV1,
    registryManifestHistory:
      fields.registryManifestHistory as readonly ProviderRegistryManifestEnvelopeV1[],
    rootMetadataHistory:
      fields.rootMetadataHistory as readonly ProviderRegistryRootMetadataEnvelopeV1[],
    strictCryptoCapability:
      capability as ProviderStrictEd25519OpaqueCapabilityV1,
  }) as unknown as ValidateProviderRegistryManifestHistoryV1Input;
  const snapshot = createPreparedRegistryHistorySnapshotInternalV1({
    bootstrapTrustBundle: registryRequest.bootstrapTrustBundle,
    installationIdentityGenerationId:
      registryRequest.installationIdentityGenerationId,
    registryManifestHistory: registryRequest.registryManifestHistory,
    rootMetadataHistory: registryRequest.rootMetadataHistory,
    strictCryptoCapability:
      capability as ProviderStrictEd25519OpaqueCapabilityV1,
  });
  const registryInputHandle = registerPreparedRegistryHistoryInputInternalV1(
    registryRequest,
    snapshot,
    capability as ProviderStrictEd25519OpaqueCapabilityV1,
  );
  return createProviderNonThenableFrozenRecordV1({
    fields,
    strictCryptoCapability:
      capability as ProviderStrictEd25519OpaqueCapabilityV1,
    registryRequest,
    registryInputHandle,
  });
}

function validateBootstrapDistributionBindingV1(
  fields: DetachedPointFieldsV1,
): void {
  let bundle: ProviderBootstrapTrustBundleV1;
  let binding: ProviderSignedDistributionRootBindingV1;
  try {
    bundle = ProviderBootstrapTrustBundleV1Schema.parse(
      fields.bootstrapTrustBundle,
    );
    binding = ProviderSignedDistributionRootBindingV1Schema.parse(
      fields.distributionRootBinding,
    );
  } catch {
    return failCatalogV1("bootstrap_distribution_binding", "schema_invalid");
  }
  const pin = ProviderBootstrapTrustBundlePinV1Schema.parse({
    locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
    contentDigest: deriveProviderBootstrapTrustBundleContentDigestV1(bundle),
  });
  if (!canonicalEqualV1(pin, binding.bootstrapTrustBundle)) {
    return failCatalogV1("bootstrap_distribution_binding", "pin_mismatch");
  }
}

function createPreparedUniverseRequestV1(
  fields: DetachedPointFieldsV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderReleaseTargetUniversePointClosureV1Input {
  return createProviderNonThenableFrozenRecordV1({
    activeRoot: fields.activeRoot,
    activeRootMetadata: fields.activeRootMetadata,
    distributionRootBinding: fields.distributionRootBinding,
    fixtureCorpusManifest: fields.fixtureCorpusManifest,
    publicSupportTaxonomy: fields.publicSupportTaxonomy,
    releaseMatrix: fields.releaseMatrix,
    releaseTargetUniverse: fields.releaseTargetUniverse,
    strictCryptoCapability: capability,
    suiteManifest: fields.suiteManifest,
    targetDiscoveryFixtureManifest: fields.targetDiscoveryFixtureManifest,
    targetDiscoveryResult: fields.targetDiscoveryResult,
    targetDiscoveryRunnerRun: fields.targetDiscoveryRunnerRun,
  }) as unknown as ValidateProviderReleaseTargetUniversePointClosureV1Input;
}

function resolveApproverV1(
  approvals: ProviderFeasibilityApprovalKeysV1,
  evidence: ProviderFeasibilityEvidenceEnvelopeV1,
  role: "qa" | "release",
): ProviderFeasibilityApproverPublicKeyV1 {
  const binding = parseProviderFeasibilityEvidenceSignatureBindingInternalV1(
    role === "qa"
      ? evidence.payload.qaSignature
      : evidence.payload.releaseSignature,
    role,
  );
  for (let index = 0; index < approvals.compromisedRevokedKeyIds.length; index += 1) {
    if (approvals.compromisedRevokedKeyIds[index] === binding.keyId) {
      return failCatalogV1("catalog_candidate_binding", "binding_mismatch");
    }
  }
  let match: ProviderFeasibilityApproverPublicKeyV1 | undefined;
  for (let index = 0; index < approvals.publicKeyRecords.length; index += 1) {
    const record = approvals.publicKeyRecords[index]!;
    if (record.role === role && record.keyId === binding.keyId) {
      match = record;
      break;
    }
  }
  if (match === undefined) {
    return failCatalogV1("catalog_candidate_binding", "binding_mismatch");
  }
  return match;
}

function resolveHistoricallyVerifiedApproverV1(
  approvals: ProviderFeasibilityApprovalKeysV1,
  evidence: ProviderFeasibilityEvidenceEnvelopeV1,
  role: "qa" | "release",
  verifiedTipEntry: RegistryHistoryVerifiedTipEntryV1,
): ProviderFeasibilityApproverPublicKeyV1 {
  const catalogRecord = resolveApproverV1(approvals, evidence, role);
  const records = verifiedTipEntry.historicallyVerifiedApproverPublicKeys;
  for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
    const record = records[recordIndex]!;
    if (
      record.role === role &&
      record.keyId === catalogRecord.keyId &&
      canonicalEqualV1(record, catalogRecord)
    ) {
      return record;
    }
  }
  return failCatalogV1("catalog_candidate_binding", "binding_mismatch");
}

function artifactResultBindingsV1(
  artifact: ProviderFeasibilitySupportCandidateArtifactV1,
): {
  readonly locator: z.infer<
    typeof ProviderRealFilesystemConformanceResultLocatorV1Schema
  >;
  readonly pin: z.infer<typeof ProviderRealFilesystemConformanceResultPinV1Schema>;
} {
  const evidencePin = artifact.providerFeasibilityEvidence.payload
    .realFilesystemConformanceResult;
  const locator = ProviderRealFilesystemConformanceResultLocatorV1Schema.parse({
    locatorProfile: evidencePin.locatorProfile,
    resultId: evidencePin.resultId,
  });
  const pin = ProviderRealFilesystemConformanceResultPinV1Schema.parse(
    evidencePin,
  );
  return createProviderNonThenableFrozenRecordV1({
    locator: deepFreezeProviderPointDetachedDataTreeV1(locator),
    pin: deepFreezeProviderPointDetachedDataTreeV1(pin),
  });
}

function createPreparedEvidenceRequestV1(
  fields: DetachedPointFieldsV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
  artifact: ProviderFeasibilitySupportCandidateArtifactV1,
  candidate: ProviderFeasibilitySupportCandidateV1,
  qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1,
  releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1,
): ValidateProviderFeasibilityEvidencePointClosureV1Input {
  const resultBindings = artifactResultBindingsV1(artifact);
  return createProviderNonThenableFrozenRecordV1({
    activeRoot: fields.activeRoot,
    activeRootMetadata: fields.activeRootMetadata,
    distributionRootBinding: fields.distributionRootBinding,
    fixtureCorpusManifest: fields.fixtureCorpusManifest,
    providerFeasibilityEvidence: artifact.providerFeasibilityEvidence,
    providerFeasibilityEvidencePin: candidate.providerFeasibilityEvidence,
    publicSupportTaxonomy: fields.publicSupportTaxonomy,
    qaApproverPublicKey,
    realFilesystemConformanceResult:
      artifact.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator: resultBindings.locator,
    realFilesystemConformanceResultPin: resultBindings.pin,
    releaseApproverPublicKey,
    releaseMatrix: fields.releaseMatrix,
    runtimeAttestation: candidate.runtimeAttestation,
    semanticProviderPolicy: candidate.semanticProviderPolicy,
    strictCryptoCapability: capability,
    suiteManifest: fields.suiteManifest,
    targetDiscoveryFixtureManifest: fields.targetDiscoveryFixtureManifest,
    targetDiscoveryResult: fields.targetDiscoveryResult,
    targetDiscoveryRunnerRun: fields.targetDiscoveryRunnerRun,
  }) as unknown as ValidateProviderFeasibilityEvidencePointClosureV1Input;
}

interface BoundCatalogCandidateV1 {
  readonly catalogTarget: ProviderFeasibilityTargetV1;
  readonly candidate: ProviderFeasibilitySupportCandidateV1;
  readonly artifact: ProviderFeasibilitySupportCandidateArtifactV1;
  readonly qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  readonly releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
}

function validateCatalogOrderingV1(
  catalog: ProviderFeasibilitySupportCatalogV1,
): void {
  for (let targetIndex = 0; targetIndex < catalog.targets.length; targetIndex += 1) {
    const group = catalog.targets[targetIndex]!;
    const {
      targetProfileId: _targetProfileId,
      ...targetIdentityFields
    } = group.target;
    if (
      group.target.targetProfileId !==
      deriveProviderTargetProfileIdV1(targetIdentityFields)
    ) {
      return failCatalogV1("catalog_target_identity", "identity_mismatch");
    }
  }
  for (let targetIndex = 1; targetIndex < catalog.targets.length; targetIndex += 1) {
    if (
      compareUtf8V1(
        catalog.targets[targetIndex - 1]!.target.targetProfileId,
        catalog.targets[targetIndex]!.target.targetProfileId,
      ) >= 0
    ) {
      return failCatalogV1("catalog_target_order", "ordering_invalid");
    }
  }
  for (let targetIndex = 0; targetIndex < catalog.targets.length; targetIndex += 1) {
    const group = catalog.targets[targetIndex]!;
    for (let candidateIndex = 1; candidateIndex < group.candidates.length; candidateIndex += 1) {
      if (
        compareUtf8V1(
          group.candidates[candidateIndex - 1]!.providerId,
          group.candidates[candidateIndex]!.providerId,
        ) >= 0
      ) {
        return failCatalogV1("catalog_candidate_order", "ordering_invalid");
      }
    }
  }
}

function validateCatalogExactCoverV1(
  catalog: ProviderFeasibilitySupportCatalogV1,
  universeClosure: ProviderReleaseTargetUniversePointClosureValidationV1,
): void {
  const universeTargets = universeClosure.releaseTargetUniverse.payload.targets;
  if (catalog.targets.length !== universeTargets.length) {
    return failCatalogV1("catalog_target_exact_cover", "coverage_mismatch");
  }
  for (let index = 0; index < universeTargets.length; index += 1) {
    if (!canonicalEqualV1(catalog.targets[index]!.target, universeTargets[index]!.target)) {
      return failCatalogV1("catalog_target_exact_cover", "coverage_mismatch");
    }
  }
}

function validateApprovalKeysAgainstRegistryTipV1(
  catalog: ProviderFeasibilitySupportCatalogV1,
  registryClosure: ProviderRegistryManifestHistoryValidationV1,
): void {
  const tip = registryClosure.registryManifestHistory[
    registryClosure.registryManifestHistory.length - 1
  ];
  if (tip === undefined) {
    return failCatalogV1("catalog_approval_keys_binding", "binding_mismatch");
  }
  let enabledCount = 0;
  for (let index = 0; index < tip.payload.members.length; index += 1) {
    const member = tip.payload.members[index]!;
    if (member.disposition !== "enabled") continue;
    enabledCount += 1;
    if (
      !canonicalEqualV1(
        member.registryEntry.feasibilityApprovalKeys,
        catalog.feasibilityApprovalKeys,
      )
    ) {
      return failCatalogV1(
        "catalog_approval_keys_binding",
        "binding_mismatch",
      );
    }
  }
  if (enabledCount === 0) {
    return failCatalogV1("catalog_approval_keys_binding", "binding_mismatch");
  }
}

function validateCandidateRegistryEqualityV1(
  registryClosure: ProviderRegistryManifestHistoryValidationV1,
  registryWitness: RegistryHistoryVerifiedCryptoWitnessV1,
  candidate: ProviderFeasibilitySupportCandidateV1,
): RegistryHistoryVerifiedTipEntryV1 {
  const tip = registryClosure.registryManifestHistory[
    registryClosure.registryManifestHistory.length - 1
  ];
  if (tip === undefined) {
    return failCatalogV1("catalog_candidate_binding", "binding_mismatch");
  }
  type EnabledRegistryMemberV1 = Extract<
    ProviderRegistryManifestEnvelopeV1["payload"]["members"][number],
    { readonly disposition: "enabled" }
  >;
  let matchedMember: EnabledRegistryMemberV1 | undefined;
  for (let index = 0; index < tip.payload.members.length; index += 1) {
    const member = tip.payload.members[index]!;
    if (member.disposition !== "enabled" || member.providerId !== candidate.providerId) continue;
    if (matchedMember !== undefined) {
      return failCatalogV1("catalog_candidate_binding", "binding_mismatch");
    }
    matchedMember = member;
  }
  if (
    matchedMember === undefined ||
    matchedMember.registryEntry.semanticProviderPolicyDigest !==
      deriveStoreDurableObjectProviderPolicyDigestV1(
        candidate.semanticProviderPolicy,
      )
  ) {
    return failCatalogV1("catalog_candidate_binding", "binding_mismatch");
  }
  let matchedWitnessEntry: RegistryHistoryVerifiedTipEntryV1 | undefined;
  for (let index = 0; index < registryWitness.verifiedTipEntries.length; index += 1) {
    const entry = registryWitness.verifiedTipEntries[index]!;
    if (
      entry.providerId !== candidate.providerId ||
      entry.registryEntryContentDigest !== matchedMember.registryEntryContentDigest ||
      !canonicalEqualV1(entry.runtimeAttestation, matchedMember.registryEntry.runtimeAttestation)
    ) {
      continue;
    }
    if (matchedWitnessEntry !== undefined) {
      return failCatalogV1("catalog_candidate_binding", "binding_mismatch");
    }
    matchedWitnessEntry = entry;
  }
  if (matchedWitnessEntry === undefined) {
    return failCatalogV1("catalog_candidate_binding", "binding_mismatch");
  }
  return matchedWitnessEntry;
}

function deriveOwnerTargetCapabilitiesV1(
  catalog: ProviderFeasibilitySupportCatalogV1,
  candidateClosures: readonly ProviderFeasibilitySupportCatalogCandidateClosureV1[],
): readonly ProviderFeasibilityOwnerTargetCapabilityV1[] {
  const output: ProviderFeasibilityOwnerTargetCapabilityV1[] = [];
  let closureIndex = 0;
  for (let targetIndex = 0; targetIndex < catalog.targets.length; targetIndex += 1) {
    const group = catalog.targets[targetIndex]!;
    let strong = false;
    for (let candidateIndex = 0; candidateIndex < group.candidates.length; candidateIndex += 1) {
      const closure = candidateClosures[closureIndex]!;
      closureIndex += 1;
      if (
        closure.evidencePointClosure.providerFeasibilityEvidence.payload.result ===
          "passed" &&
        group.candidates[candidateIndex]!.releaseDisposition ===
          "strong_read_write"
      ) {
        strong = true;
      }
    }
    output[output.length] = createProviderNonThenableFrozenRecordV1({
        target: group.target,
        capability: strong
          ? ("strong_read_write" as const)
          : ("legacy_redacted_read_only" as const),
      });
  }
  return CapturedObjectFreezeV1(output);
}

function derivePublicSupportV1(
  universeClosure: ProviderReleaseTargetUniversePointClosureValidationV1,
  ownerTargetCapabilities: readonly ProviderFeasibilityOwnerTargetCapabilityV1[],
): readonly ProviderFeasibilityPublicSupportV1[] {
  const universe = universeClosure.releaseTargetUniverse.payload;
  const output: ProviderFeasibilityPublicSupportV1[] = [];
  for (let bucketIndex = 0; bucketIndex < universe.buckets.length; bucketIndex += 1) {
    const bucket = universe.buckets[bucketIndex]!;
    const expectedPublicProfileId = deriveProviderPublicSupportProfileIdV1({
      osPlatform: bucket.osPlatform,
      osReleaseFamilyCode: bucket.osReleaseFamilyCode,
      architecture: bucket.architecture,
      filesystemProfileCode: bucket.filesystemProfileCode,
    });
    if (expectedPublicProfileId !== bucket.publicProfileId) {
      return failCatalogV1("catalog_target_exact_cover", "coverage_mismatch");
    }
    let allStrong = bucket.coverage.coverageState === "closed_world_complete";
    for (let memberIndex = 0; memberIndex < bucket.coverage.targetProfileIds.length; memberIndex += 1) {
      const targetProfileId = bucket.coverage.targetProfileIds[memberIndex]!;
      let found = false;
      for (let targetIndex = 0; targetIndex < ownerTargetCapabilities.length; targetIndex += 1) {
        const owner = ownerTargetCapabilities[targetIndex]!;
        if (owner.target.targetProfileId !== targetProfileId) continue;
        found = true;
        if (owner.capability !== "strong_read_write") allStrong = false;
        break;
      }
      if (!found) {
        return failCatalogV1("catalog_target_exact_cover", "coverage_mismatch");
      }
    }
    output[output.length] = createProviderNonThenableFrozenRecordV1({
        profile: "provider_feasibility_public_support_v1" as const,
        publicProfileId: bucket.publicProfileId,
        osPlatform: bucket.osPlatform,
        osReleaseFamilyCode: bucket.osReleaseFamilyCode,
        architecture: bucket.architecture,
        filesystemProfileCode: bucket.filesystemProfileCode,
        capability: allStrong
          ? ("strong_read_write" as const)
          : ("legacy_redacted_read_only" as const),
      });
  }
  return CapturedObjectFreezeV1(output);
}

async function validateCatalogPointInternalV1(
  prepared: PreparedCatalogPointInputV1,
): Promise<ProviderFeasibilitySupportCatalogPointClosureValidationV1> {
  const { fields, strictCryptoCapability } = prepared;
  let registryClosure: ProviderRegistryManifestHistoryValidationV1 | undefined;
  let registryTrustWitnessHandle: RegistryTrustWitnessHandleV1 | undefined;
  let registryWitness: RegistryHistoryVerifiedCryptoWitnessV1 | undefined;
  try {
    validateBootstrapDistributionBindingV1(fields);
    let registryDiagnostic;
    try {
      registryDiagnostic = await hardenProviderPointPromiseV1(
        diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
          prepared.registryRequest,
          prepared.registryInputHandle,
          strictCryptoCapability,
        ),
      );
    } catch {
      return failCatalogV1("registry_history_closure", "source_invalid");
    }
    if (!registryDiagnostic.ok) {
      return failCatalogV1("registry_history_closure", "source_invalid");
    }
    registryClosure = registryDiagnostic.value.closure;
    registryTrustWitnessHandle =
      registryDiagnostic.value.registryTrustWitnessHandle;
    registryWitness = takeRegistryHistoryVerifiedWitnessInternalV1(
      registryClosure,
      registryTrustWitnessHandle,
      strictCryptoCapability,
    );
    if (registryWitness === undefined) {
      return failCatalogV1("registry_history_closure", "source_invalid");
    }

    const activeRoot = ProviderRegistryRootPublicKeyV1Schema.parse(
      fields.activeRoot,
    );
    if (!canonicalEqualV1(activeRoot, registryWitness.suppliedHistoryTipRoot)) {
      return failCatalogV1("registry_history_closure", "source_invalid");
    }

    const universeDiagnostic =
      await diagnoseProviderReleaseTargetUniversePointPreparedInternalV1(
        createPreparedUniverseRequestV1(fields, strictCryptoCapability),
      );
    if (!universeDiagnostic.ok) {
      return failCatalogV1(
        "release_target_universe_closure",
        "source_invalid",
      );
    }
    const universeClosure = universeDiagnostic.value;

    let catalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
    let artifacts: readonly ProviderFeasibilitySupportCandidateArtifactV1[];
    try {
      catalogEnvelope = deepFreezeProviderPointDetachedDataTreeV1(
        ProviderFeasibilitySupportCatalogEnvelopeV1Schema.parse(
          fields.providerFeasibilitySupportCatalog,
        ),
      );
    } catch {
      return failCatalogV1("catalog_structure", "schema_invalid");
    }
    try {
      artifacts = deepFreezeProviderPointDetachedDataTreeV1(
        z
          .array(ProviderFeasibilitySupportCandidateArtifactV1Schema)
          .min(1)
          .parse(fields.providerFeasibilitySupportCandidateArtifacts),
      );
    } catch {
      return failCatalogV1("candidate_artifacts_structure", "schema_invalid");
    }
    const catalog = catalogEnvelope.payload;
    if (
      (catalog.catalogGeneration === 1) !==
      (catalog.predecessorCatalogContentDigest === undefined)
    ) {
      return failCatalogV1("catalog_generation", "coverage_mismatch");
    }
    if (!canonicalEqualV1(catalog.distributionRootBinding, fields.distributionRootBinding)) {
      return failCatalogV1("catalog_distribution_binding", "binding_mismatch");
    }
    if (
      !canonicalEqualV1(catalog.activeRootMetadata, fields.activeRootMetadata) ||
      catalog.registryRootKeyId !== activeRoot.rootKeyId
    ) {
      return failCatalogV1("catalog_active_root", "root_mismatch");
    }
    validateApprovalKeysAgainstRegistryTipV1(catalog, registryClosure);
    if (
      !canonicalEqualV1(
        catalog.publicSupportTaxonomy,
        universeClosure.releaseTargetUniverse.payload.publicSupportTaxonomy,
      )
    ) {
      return failCatalogV1("catalog_taxonomy_pin", "pin_mismatch");
    }
    if (
      !canonicalEqualV1(
        catalog.releaseTargetUniverse,
        universeClosure.releaseTargetUniversePin,
      )
    ) {
      return failCatalogV1("catalog_universe_pin", "pin_mismatch");
    }
    validateCatalogOrderingV1(catalog);
    validateCatalogExactCoverV1(catalog, universeClosure);

    let candidateCount = 0;
    for (let targetIndex = 0; targetIndex < catalog.targets.length; targetIndex += 1) {
      candidateCount += catalog.targets[targetIndex]!.candidates.length;
    }
    if (artifacts.length !== candidateCount) {
      return failCatalogV1("catalog_candidate_binding", "count_mismatch");
    }

    const boundCandidates: BoundCatalogCandidateV1[] = [];
    let artifactIndex = 0;
    for (let targetIndex = 0; targetIndex < catalog.targets.length; targetIndex += 1) {
      const group = catalog.targets[targetIndex]!;
      for (let candidateIndex = 0; candidateIndex < group.candidates.length; candidateIndex += 1) {
        const candidate = group.candidates[candidateIndex]!;
        const artifact = artifacts[artifactIndex]!;
        artifactIndex += 1;
        const evidence = artifact.providerFeasibilityEvidence;
        if (
          evidence.payload.providerId !== candidate.providerId ||
          !canonicalEqualV1(evidence.payload.target, group.target) ||
          !canonicalEqualV1(
            candidate.providerFeasibilityEvidence,
            {
              locatorProfile: "installation_provider_feasibility_evidence_v1",
              evidenceId: evidence.evidenceId,
              contentDigest: evidence.contentDigest,
            },
          )
        ) {
          return failCatalogV1("catalog_candidate_binding", "binding_mismatch");
        }
        const verifiedTipEntry = validateCandidateRegistryEqualityV1(
          registryClosure,
          registryWitness,
          candidate,
        );
        const qaApproverPublicKey = resolveHistoricallyVerifiedApproverV1(
          catalog.feasibilityApprovalKeys,
          evidence,
          "qa",
          verifiedTipEntry,
        );
        const releaseApproverPublicKey =
          resolveHistoricallyVerifiedApproverV1(
            catalog.feasibilityApprovalKeys,
            evidence,
            "release",
            verifiedTipEntry,
          );
        boundCandidates[boundCandidates.length] =
          createProviderNonThenableFrozenRecordV1({
            catalogTarget: group.target,
            candidate,
            artifact,
            qaApproverPublicKey,
            releaseApproverPublicKey,
          });
      }
    }

    const candidateClosures: ProviderFeasibilitySupportCatalogCandidateClosureV1[] = [];
    for (let index = 0; index < boundCandidates.length; index += 1) {
        const bound = boundCandidates[index]!;
        const evidenceRequest = createPreparedEvidenceRequestV1(
          fields,
          strictCryptoCapability,
          bound.artifact,
          bound.candidate,
          bound.qaApproverPublicKey,
          bound.releaseApproverPublicKey,
        );
        const registryTrustedApproverHandle =
          registerProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1(
            evidenceRequest,
            bound.qaApproverPublicKey,
            bound.releaseApproverPublicKey,
            strictCryptoCapability,
          );
        const evidenceDiagnostic =
          await diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1(
            evidenceRequest,
            registryTrustedApproverHandle,
            strictCryptoCapability,
          );
        if (!evidenceDiagnostic.ok) {
          return failCatalogV1("candidate_deep_closure", "source_invalid");
        }
        candidateClosures[candidateClosures.length] =
          createProviderNonThenableFrozenRecordV1({
            catalogTarget: bound.catalogTarget,
            catalogCandidate: bound.candidate,
            evidencePointClosure: evidenceDiagnostic.value,
          });
    }
    for (let index = 0; index < boundCandidates.length; index += 1) {
      const bound = boundCandidates[index]!;
      const closure = candidateClosures[index]!;
      if (
        bound.candidate.releaseDisposition === "strong_read_write" &&
        closure.evidencePointClosure.providerFeasibilityEvidence.payload.result !==
          "passed"
      ) {
        return failCatalogV1(
          "catalog_release_disposition",
          "result_not_passed",
        );
      }
    }

    const signatureMatch = regExpExecV1(
      CATALOG_SIGNATURE_PATTERN_V1,
      catalog.catalogSignature,
    );
    if (
      signatureMatch?.[1] === undefined ||
      signatureMatch[2] === undefined ||
      signatureMatch[1] !== activeRoot.rootKeyId
    ) {
      return failCatalogV1("catalog_signature_binding", "root_mismatch");
    }
    try {
      const accepted = await verifyRawEd25519WithCapabilityV1(
        strictCryptoCapability,
        decodeCanonicalPublicKeyBytes32V1(activeRoot.publicKeyBytes),
        createProviderFeasibilitySupportCatalogSignatureMessageV1(
          catalog,
          activeRoot.rootKeyId,
        ),
        lowerHexToBytesV1(signatureMatch[2]),
      );
      if (!accepted) {
        return failCatalogV1("catalog_signature", "signature_invalid");
      }
    } catch (error) {
      if (isCatalogDiagnosticSignalV1(error)) throw error;
      return failCatalogV1("catalog_signature", "signature_invalid");
    }
    if (
      catalogEnvelope.contentDigest !==
      deriveProviderFeasibilitySupportCatalogContentDigestV1(catalog)
    ) {
      return failCatalogV1("catalog_digest", "digest_mismatch");
    }
    if (catalogEnvelope.catalogGeneration !== catalog.catalogGeneration) {
      return failCatalogV1("catalog_envelope", "envelope_mismatch");
    }
    const pin = deepFreezeProviderPointDetachedDataTreeV1(
      ProviderFeasibilitySupportCatalogPinV1Schema.parse({
        locatorProfile:
          PROVIDER_FEASIBILITY_SUPPORT_CATALOG_LOCATOR_PROFILE_V1,
        catalogGeneration: catalog.catalogGeneration,
        contentDigest: catalogEnvelope.contentDigest,
      }),
    );
    const relativePath = buildProviderFeasibilitySupportCatalogRelativePathV1(
      pin,
    );
    const frozenCandidateClosures = CapturedObjectFreezeV1(candidateClosures);
    const ownerTargetCapabilities = deriveOwnerTargetCapabilitiesV1(
      catalog,
      frozenCandidateClosures,
    );
    const publicSupport = derivePublicSupportV1(
      universeClosure,
      ownerTargetCapabilities,
    );
    return createProviderNonThenableFrozenRecordV1({
      authority: PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
      registryManifestHistoryClosure: registryClosure,
      releaseTargetUniversePointClosure: universeClosure,
      candidateDeepClosures: frozenCandidateClosures,
      ownerTargetCapabilities,
      publicSupport,
      providerFeasibilitySupportCatalog: catalogEnvelope,
      providerFeasibilitySupportCatalogPin: pin,
      relativePath,
      targetCount: catalog.targets.length,
      candidateCount,
      publicSupportRowCount: publicSupport.length,
    });
  } finally {
    discardPreparedRegistryHistoryInputInternalV1(
      prepared.registryRequest,
      prepared.registryInputHandle,
      strictCryptoCapability,
    );
    if (
      registryClosure !== undefined &&
      registryTrustWitnessHandle !== undefined &&
      registryWitness === undefined
    ) {
      discardRegistryHistoryVerifiedWitnessInternalV1(
        registryClosure,
        registryTrustWitnessHandle,
        strictCryptoCapability,
      );
    }
  }
}

function diagnosticFailureV1(
  stage: ProviderFeasibilitySupportCatalogPointInvalidStageV1,
  reason: ProviderFeasibilitySupportCatalogPointInvalidReasonV1,
): CatalogDiagnosticFailureV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function diagnosticFailureFromErrorV1(error: unknown): CatalogDiagnosticFailureV1 {
  if (isCatalogDiagnosticSignalV1(error)) {
    return diagnosticFailureV1(error.stage, error.reason);
  }
  return diagnosticFailureV1("registry_history_closure", "source_invalid");
}

export function diagnoseProviderFeasibilitySupportCatalogPointClosureV1(
  input: unknown,
): Promise<ProviderFeasibilitySupportCatalogPointClosureDiagnosticResultV1> {
  let prepared: PreparedCatalogPointInputV1;
  try {
    prepared = prepareCatalogPointInputV1(input);
  } catch {
    return createProviderPointFulfilledPromiseV1(
      diagnosticFailureV1("input", "schema_invalid"),
    );
  }
  let operation: Promise<ProviderFeasibilitySupportCatalogPointClosureValidationV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      validateCatalogPointInternalV1(prepared),
    );
  } catch (error) {
    return createProviderPointFulfilledPromiseV1(
      diagnosticFailureFromErrorV1(error),
    );
  }
  return operation.then(
    (value) => createProviderNonThenableFrozenRecordV1({ ok: true as const, value }),
    (error) => diagnosticFailureFromErrorV1(error),
  );
}

export function validateProviderFeasibilitySupportCatalogPointClosureV1(
  input: ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
): Promise<ProviderFeasibilitySupportCatalogPointClosureValidationV1> {
  let prepared: PreparedCatalogPointInputV1;
  try {
    prepared = prepareCatalogPointInputV1(input);
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderFeasibilitySupportCatalogPointClosureValidationError(),
    );
  }
  let operation: Promise<ProviderFeasibilitySupportCatalogPointClosureValidationV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      validateCatalogPointInternalV1(prepared),
    );
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderFeasibilitySupportCatalogPointClosureValidationError(),
    );
  }
  return operation.then(
    (value) => value,
    () => {
      throw new ProviderFeasibilitySupportCatalogPointClosureValidationError();
    },
  );
}

CapturedObjectFreezeV1(
  projectProviderFeasibilitySupportCatalogUnsignedClaimsV1,
);
CapturedObjectFreezeV1(
  deriveProviderFeasibilitySupportCatalogContentDigestV1,
);
CapturedObjectFreezeV1(
  createProviderFeasibilitySupportCatalogSignatureMessageV1,
);
CapturedObjectFreezeV1(deriveProviderFeasibilitySupportCatalogPinV1);
CapturedObjectFreezeV1(buildProviderFeasibilitySupportCatalogRelativePathV1);
CapturedObjectFreezeV1(
  diagnoseProviderFeasibilitySupportCatalogPointClosureV1,
);
CapturedObjectFreezeV1(
  validateProviderFeasibilitySupportCatalogPointClosureV1,
);
