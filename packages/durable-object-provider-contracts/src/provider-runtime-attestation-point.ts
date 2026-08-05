import { z } from "zod";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  ProviderFilesystemProfileCodeV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  diagnoseProviderRealFilesystemConformanceResultClosureV1,
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  type ProviderRealFilesystemConformanceResultClosureValidationV1,
  type ValidateProviderRealFilesystemConformanceResultClosureV1Input,
} from "./provider-real-filesystem-conformance-result.js";
import {
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
  StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  StoreDurableObjectProviderRuntimeAttestationV1Schema,
  type StoreDurableObjectProviderRuntimeAttestationPinV1,
  type StoreDurableObjectProviderRuntimeAttestationV1,
} from "./provider-registry-records.js";
import {
  ProviderRegistryRootPublicKeyV1Schema,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

export const STORE_DURABLE_OBJECT_PROVIDER_POLICY_DOMAIN_V1 =
  "store-durable-object-provider-policy-v1" as const;
export const STORE_PROVIDER_FILESYSTEM_PROFILE_DOMAIN_V1 =
  "store-provider-filesystem-profile-v1" as const;

export const StoreDurableObjectProviderIsolationV1Schema =
  z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("separate_os_principal"),
      securityBoundaryProfileDigest: ContentDigestV1Schema,
    }),
    z.strictObject({
      kind: z.literal("kernel_isolated_storage_domain"),
      securityBoundaryProfileDigest: ContentDigestV1Schema,
    }),
  ]);
export type StoreDurableObjectProviderIsolationV1 = z.infer<
  typeof StoreDurableObjectProviderIsolationV1Schema
>;

export const StoreManifestCompareAppendReceiptLedgerPolicyV1Schema =
  z.strictObject({
    profile: z.literal(
      "store_manifest_compare_append_receipt_ledger_policy_v1",
    ),
    locatorProfile: z.literal("store_manifest_compare_append_receipt_v1"),
    storageBoundary: z.literal("provider_isolated_non_store_namespace"),
    appendSemantics: z.literal(
      "immutable_no_replace_by_repository_worktree_operation_nonce",
    ),
    maxReceiptCountPerRepositoryWorktree: z.literal(16_384),
    maxReceiptLogicalBytesPerRepositoryWorktree: z.literal(67_108_864),
    maxSingleReceiptLogicalBytes: z.literal(1_048_576),
    admission: z.literal(
      "freeze_resolved_at_and_complete_signed_receipt_then_reserve_exact_count_and_canonical_bytes_before_atomic_namespace_commit",
    ),
    quotaAccounting: z.literal("excluded_from_private_store_quota_root"),
  });
export type StoreManifestCompareAppendReceiptLedgerPolicyV1 = z.infer<
  typeof StoreManifestCompareAppendReceiptLedgerPolicyV1Schema
>;

export const StoreDurableObjectProviderPolicyV1Schema = z.strictObject({
  profile: z.literal("store_durable_object_provider_policy_v1"),
  protocolVersion: z.literal(1),
  providerId: DurableObjectIdentityProviderIdV1Schema,
  ipcPeerAuthenticationPolicyDigest: ContentDigestV1Schema,
  isolation: StoreDurableObjectProviderIsolationV1Schema,
  sourceNamespaceVisibility: z.literal("inaccessible_to_workspace_writer"),
  supportedStagingObjectKinds: z.tuple([
    z.literal("regular"),
    z.literal("directory"),
  ]),
  stagingRecovery: z.literal(
    "opaque_locator_idempotent_allocate_or_reopen_exact_unpublished_object_across_restart",
  ),
  durableIdentity: z.literal(
    "same_object_stable_aba_recreate_distinct_across_restart",
  ),
  publishSemantics: z.literal(
    "exact_opened_object_no_replace_with_atomic_bound_root_containment",
  ),
  externalIntentStateSemantics: z.literal(
    "atomic_monotonic_compare_replace_with_restart_receipt_and_handoff_cut",
  ),
  handoffJournalSemantics: z.literal(
    "immutable_no_replace_compare_tip_complete_enumeration_prospective_sealed_version_atomic_seal",
  ),
  storeManifestCompareAppendReceiptLedger:
    StoreManifestCompareAppendReceiptLedgerPolicyV1Schema,
  deleteSemantics: z.enum([
    "exact_opened_object_atomic_compare_delete_with_containment",
    "disabled",
  ]),
  stockSameUidFilesystemFallback: z.literal("forbidden"),
  realFilesystemConformanceSuiteDigest: ContentDigestV1Schema,
});
export type StoreDurableObjectProviderPolicyV1 = z.infer<
  typeof StoreDurableObjectProviderPolicyV1Schema
>;

export const StoreProviderFilesystemProfileFieldsV1Schema = z.strictObject({
  filesystemProfileCode: ProviderFilesystemProfileCodeV1Schema,
  filesystemFeatureProfileDigest: ContentDigestV1Schema,
  mountOptionProfileDigest: ContentDigestV1Schema,
});
export type StoreProviderFilesystemProfileFieldsV1 = z.infer<
  typeof StoreProviderFilesystemProfileFieldsV1Schema
>;

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function parseStrictFieldsV1<T>(schema: z.ZodType<T>, input: unknown): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  return schema.parse(input);
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

export function deriveStoreDurableObjectProviderPolicyDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    STORE_DURABLE_OBJECT_PROVIDER_POLICY_DOMAIN_V1,
    parseStrictFieldsV1(StoreDurableObjectProviderPolicyV1Schema, input),
  );
}

export function deriveStoreProviderFilesystemProfileDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    STORE_PROVIDER_FILESYSTEM_PROFILE_DOMAIN_V1,
    parseStrictFieldsV1(StoreProviderFilesystemProfileFieldsV1Schema, input),
  );
}

export const ProviderRuntimeAttestationPointInvalidStageV1Schema = z.enum([
  "input",
  "conformance_result_closure",
  "semantic_policy_structure",
  "semantic_policy_digest",
  "result_policy_binding",
  "runtime_pin",
  "runtime_structure",
  "runtime_result_binding",
  "runtime_root",
  "runtime_signature",
]);
export type ProviderRuntimeAttestationPointInvalidStageV1 = z.infer<
  typeof ProviderRuntimeAttestationPointInvalidStageV1Schema
>;

export const ProviderRuntimeAttestationPointInvalidReasonV1Schema = z.enum([
  "schema_invalid",
  "source_invalid",
  "digest_mismatch",
  "binding_mismatch",
  "root_mismatch",
  "signature_invalid",
  "pin_mismatch",
]);
export type ProviderRuntimeAttestationPointInvalidReasonV1 = z.infer<
  typeof ProviderRuntimeAttestationPointInvalidReasonV1Schema
>;

interface RuntimePointDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderRuntimeAttestationPointInvalidStageV1;
  readonly reason: ProviderRuntimeAttestationPointInvalidReasonV1;
}

interface RuntimePointDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderRuntimeAttestationPointClosureValidationV1;
}

export type ProviderRuntimeAttestationPointClosureDiagnosticResultV1 =
  | RuntimePointDiagnosticFailureV1
  | RuntimePointDiagnosticSuccessV1;

class RuntimePointDiagnosticSignal extends Error {
  constructor(
    readonly stage: ProviderRuntimeAttestationPointInvalidStageV1,
    readonly reason: ProviderRuntimeAttestationPointInvalidReasonV1,
  ) {
    super("provider runtime attestation point diagnostic");
  }
}

function fail(
  stage: ProviderRuntimeAttestationPointInvalidStageV1,
  reason: ProviderRuntimeAttestationPointInvalidReasonV1,
): never {
  throw new RuntimePointDiagnosticSignal(stage, reason);
}

export interface ValidateProviderRuntimeAttestationPointClosureV1Input
  extends ValidateProviderRealFilesystemConformanceResultClosureV1Input {
  readonly semanticProviderPolicy: StoreDurableObjectProviderPolicyV1;
  readonly runtimeAttestation: StoreDurableObjectProviderRuntimeAttestationPinV1;
}

export interface ProviderRuntimeAttestationPointClosureValidationV1 {
  readonly authority: "none_provider_runtime_attestation_structure_only";
  readonly conformanceResultClosure:
    ProviderRealFilesystemConformanceResultClosureValidationV1;
  readonly semanticProviderPolicy: StoreDurableObjectProviderPolicyV1;
  readonly semanticProviderPolicyDigest: ContentDigestV1;
  readonly filesystemProfile: StoreProviderFilesystemProfileFieldsV1;
  readonly filesystemProfileDigest: ContentDigestV1;
  readonly runtimeAttestation: StoreDurableObjectProviderRuntimeAttestationPinV1;
}

export class ProviderRuntimeAttestationPointClosureValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider runtime attestation point closure validation failed");
    this.name = "ProviderRuntimeAttestationPointClosureValidationError";
  }
}

const RUNTIME_POINT_INPUT_KEYS = [
  "activeRoot",
  "activeRootMetadata",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "publicSupportTaxonomy",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultLocator",
  "realFilesystemConformanceResultPin",
  "releaseMatrix",
  "runtimeAttestation",
  "semanticProviderPolicy",
  "strictCryptoCapability",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const;

type RuntimePointInputKeyV1 = (typeof RUNTIME_POINT_INPUT_KEYS)[number];
type SnapshotRuntimePointInputV1 = Record<RuntimePointInputKeyV1, unknown>;

function deepFreezeV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeV1(child);
    Object.freeze(value);
  }
  return value;
}

function snapshotRuntimePointInputV1(
  input: unknown,
): SnapshotRuntimePointInputV1 {
  try {
    assertDataObjectDescriptorsBeforeSchemaV1(input);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = Object.keys(descriptors).sort();
    if (
      keys.length !== RUNTIME_POINT_INPUT_KEYS.length ||
      keys.some((key, index) => key !== RUNTIME_POINT_INPUT_KEYS[index])
    ) {
      return fail("input", "schema_invalid");
    }

    const captured = {} as SnapshotRuntimePointInputV1;
    for (const key of RUNTIME_POINT_INPUT_KEYS) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        return fail("input", "schema_invalid");
      }
      captured[key] = descriptor.value;
    }

    const { strictCryptoCapability, ...jsonArtifacts } = captured;
    assertJsonDataTreeBeforeSchemaV1(jsonArtifacts);
    // structuredClone rejects a top-level Proxy while the explicit JSON-tree
    // walk above rejects nested aliases, cycles, accessors, hidden/symbol keys,
    // sparse arrays, and custom prototypes without evaluating their getters.
    structuredClone(input as object);
    const isolatedArtifacts = structuredClone(jsonArtifacts);
    assertJsonDataTreeBeforeSchemaV1(isolatedArtifacts);
    return {
      ...deepFreezeV1(isolatedArtifacts),
      strictCryptoCapability,
    } as SnapshotRuntimePointInputV1;
  } catch (error) {
    if (error instanceof RuntimePointDiagnosticSignal) throw error;
    return fail("input", "schema_invalid");
  }
}

interface RuntimeAttestationPinOuterV1 {
  readonly profile: StoreDurableObjectProviderRuntimeAttestationPinV1["profile"];
  readonly contentDigest: ContentDigestV1;
  readonly payload: unknown;
}

const RUNTIME_ATTESTATION_PIN_OUTER_KEYS = [
  "contentDigest",
  "payload",
  "profile",
] as const;

function parseRuntimeAttestationPinOuterV1(
  input: unknown,
): RuntimeAttestationPinOuterV1 {
  try {
    assertDataObjectDescriptorsBeforeSchemaV1(input);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = Object.keys(descriptors).sort();
    if (
      keys.length !== RUNTIME_ATTESTATION_PIN_OUTER_KEYS.length ||
      keys.some(
        (key, index) => key !== RUNTIME_ATTESTATION_PIN_OUTER_KEYS[index],
      )
    ) {
      return fail("runtime_pin", "schema_invalid");
    }
    for (const key of RUNTIME_ATTESTATION_PIN_OUTER_KEYS) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        return fail("runtime_pin", "schema_invalid");
      }
    }
    return {
      profile: StoreDurableObjectProviderRuntimeAttestationPinV1Schema.shape.profile.parse(
        descriptors.profile!.value,
      ),
      contentDigest:
        StoreDurableObjectProviderRuntimeAttestationPinV1Schema.shape.contentDigest.parse(
          descriptors.contentDigest!.value,
        ),
      payload: descriptors.payload!.value,
    };
  } catch (error) {
    if (error instanceof RuntimePointDiagnosticSignal) throw error;
    return fail("runtime_pin", "schema_invalid");
  }
}

const REGISTRY_SIGNATURE_PATTERN_V1 =
  /^provider-registry-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const BASE64URL_PREFIX_V1 = "base64url:";
const BASE64URL_ALPHABET_V1 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function lowerHexToBytesV1(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/u.test(hex)) {
    throw new TypeError("signature is not lowercase octets");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  if (!value.startsWith(BASE64URL_PREFIX_V1)) {
    throw new TypeError("public key bytes have the wrong prefix");
  }
  const body = value.slice(BASE64URL_PREFIX_V1.length);
  const decoded = new Uint8Array(32);
  let accumulator = 0;
  let availableBits = 0;
  let offset = 0;
  for (const character of body) {
    const digit = BASE64URL_ALPHABET_V1.indexOf(character);
    if (digit < 0) throw new TypeError("public key bytes are not base64url");
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      if (offset >= decoded.byteLength) {
        throw new TypeError("public key bytes exceed raw32");
      }
      decoded[offset] = (accumulator >>> availableBits) & 0xff;
      offset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (offset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new TypeError("public key bytes are not canonical raw32");
  }
  return decoded;
}

async function verifyRuntimeSignatureV1(
  runtime: StoreDurableObjectProviderRuntimeAttestationV1,
  activeRoot: ProviderRegistryRootPublicKeyV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const match = REGISTRY_SIGNATURE_PATTERN_V1.exec(runtime.registrySignature);
  if (match?.[1] === undefined || match[2] === undefined) {
    return fail("runtime_structure", "schema_invalid");
  }
  if (match[1] !== activeRoot.rootKeyId) {
    return fail("runtime_root", "root_mismatch");
  }

  let message: Uint8Array;
  try {
    // Supplying the already-validated active root ID forces the signature wire
    // prefix and the wrapper rootKeyId chosen by the existing builder to agree.
    message =
      createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
        runtime,
        activeRoot.rootKeyId,
      );
  } catch {
    return fail("runtime_root", "root_mismatch");
  }

  try {
    const accepted = await verifyRawEd25519WithCapabilityV1(
      capability,
      decodeCanonicalPublicKeyBytes32V1(activeRoot.publicKeyBytes),
      message,
      lowerHexToBytesV1(match[2]),
    );
    if (!accepted) return fail("runtime_signature", "signature_invalid");
  } catch (error) {
    if (error instanceof RuntimePointDiagnosticSignal) throw error;
    return fail("runtime_signature", "signature_invalid");
  }
}

async function validateRuntimePointClosureInternalV1(
  input: unknown,
): Promise<ProviderRuntimeAttestationPointClosureValidationV1> {
  // This is the only caller-owned read phase and completes before the first
  // await. The nested C09-1H call receives only this detached snapshot.
  const snapshot = snapshotRuntimePointInputV1(input);

  const conformanceDiagnostic =
    await diagnoseProviderRealFilesystemConformanceResultClosureV1({
      activeRoot: snapshot.activeRoot,
      activeRootMetadata: snapshot.activeRootMetadata,
      distributionRootBinding: snapshot.distributionRootBinding,
      fixtureCorpusManifest: snapshot.fixtureCorpusManifest,
      publicSupportTaxonomy: snapshot.publicSupportTaxonomy,
      realFilesystemConformanceResult:
        snapshot.realFilesystemConformanceResult,
      realFilesystemConformanceResultLocator:
        snapshot.realFilesystemConformanceResultLocator,
      realFilesystemConformanceResultPin:
        snapshot.realFilesystemConformanceResultPin,
      releaseMatrix: snapshot.releaseMatrix,
      strictCryptoCapability:
        snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
      suiteManifest: snapshot.suiteManifest,
      targetDiscoveryFixtureManifest:
        snapshot.targetDiscoveryFixtureManifest,
      targetDiscoveryResult: snapshot.targetDiscoveryResult,
      targetDiscoveryRunnerRun: snapshot.targetDiscoveryRunnerRun,
    });
  if (!conformanceDiagnostic.ok) {
    return fail("conformance_result_closure", "source_invalid");
  }
  const conformanceResultClosure = conformanceDiagnostic.value;

  let resultEnvelope: ReturnType<
    typeof ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse
  >;
  let activeRoot: ProviderRegistryRootPublicKeyV1;
  try {
    resultEnvelope =
      ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse(
        snapshot.realFilesystemConformanceResult,
      );
    activeRoot = ProviderRegistryRootPublicKeyV1Schema.parse(
      snapshot.activeRoot,
    );
  } catch {
    // C09-1H success makes this unreachable for honest implementations; keep
    // any delegated/source inconsistency at the outer source boundary.
    return fail("conformance_result_closure", "source_invalid");
  }

  let semanticProviderPolicy: StoreDurableObjectProviderPolicyV1;
  try {
    semanticProviderPolicy = parseStrictFieldsV1(
      StoreDurableObjectProviderPolicyV1Schema,
      snapshot.semanticProviderPolicy,
    );
  } catch {
    return fail("semantic_policy_structure", "schema_invalid");
  }

  let semanticProviderPolicyDigest: ContentDigestV1;
  try {
    semanticProviderPolicyDigest =
      deriveStoreDurableObjectProviderPolicyDigestV1(
        semanticProviderPolicy,
      );
  } catch {
    return fail("semantic_policy_structure", "schema_invalid");
  }
  const result = resultEnvelope.payload;
  if (semanticProviderPolicyDigest !== result.semanticProviderPolicyDigest) {
    return fail("semantic_policy_digest", "digest_mismatch");
  }
  if (
    semanticProviderPolicy.providerId !== result.providerId ||
    semanticProviderPolicy.realFilesystemConformanceSuiteDigest !==
      result.suiteDigest
  ) {
    return fail("result_policy_binding", "binding_mismatch");
  }

  const runtimePinOuter = parseRuntimeAttestationPinOuterV1(
    snapshot.runtimeAttestation,
  );
  let runtime: StoreDurableObjectProviderRuntimeAttestationV1;
  try {
    runtime = StoreDurableObjectProviderRuntimeAttestationV1Schema.parse(
      runtimePinOuter.payload,
    );
  } catch {
    return fail("runtime_structure", "schema_invalid");
  }
  if (semanticProviderPolicyDigest !== runtime.semanticProviderPolicyDigest) {
    return fail("semantic_policy_digest", "digest_mismatch");
  }

  let runtimeContentDigest: ContentDigestV1;
  try {
    runtimeContentDigest =
      deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
        runtime,
      );
  } catch {
    return fail("runtime_structure", "schema_invalid");
  }
  if (runtimePinOuter.contentDigest !== runtimeContentDigest) {
    return fail("runtime_pin", "pin_mismatch");
  }

  const filesystemProfile = StoreProviderFilesystemProfileFieldsV1Schema.parse(
    {
      filesystemProfileCode: result.target.filesystemProfileCode,
      filesystemFeatureProfileDigest:
        result.target.filesystemFeatureProfileDigest,
      mountOptionProfileDigest: result.target.mountOptionProfileDigest,
    },
  );
  const filesystemProfileDigest =
    deriveStoreProviderFilesystemProfileDigestV1(filesystemProfile);
  if (
    runtime.providerId !== result.providerId ||
    runtime.implementationDigest !== result.implementationDigest ||
    runtime.binaryAttestationDigest !== result.binaryAttestationDigest ||
    runtime.osPlatform !== result.target.osPlatform ||
    runtime.osReleaseFamilyCode !== result.target.osReleaseFamilyCode ||
    runtime.osBuildDigest !== result.target.osBuildDigest ||
    runtime.architecture !== result.target.architecture ||
    runtime.filesystemProfileDigest !== filesystemProfileDigest ||
    runtime.realFilesystemConformanceResultDigest !==
      conformanceResultClosure.result.contentDigest ||
    runtime.realFilesystemConformanceResultDigest !==
      resultEnvelope.contentDigest
  ) {
    return fail("runtime_result_binding", "binding_mismatch");
  }

  await verifyRuntimeSignatureV1(
    runtime,
    activeRoot,
    snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
  );

  const runtimeAttestation: StoreDurableObjectProviderRuntimeAttestationPinV1 =
    {
      profile: runtimePinOuter.profile,
      contentDigest: runtimeContentDigest,
      payload: runtime,
    };
  return deepFreezeV1({
    authority: "none_provider_runtime_attestation_structure_only" as const,
    conformanceResultClosure,
    semanticProviderPolicy,
    semanticProviderPolicyDigest,
    filesystemProfile,
    filesystemProfileDigest,
    runtimeAttestation,
  });
}

export async function diagnoseProviderRuntimeAttestationPointClosureV1(
  input: unknown,
): Promise<ProviderRuntimeAttestationPointClosureDiagnosticResultV1> {
  try {
    return {
      ok: true,
      value: await validateRuntimePointClosureInternalV1(input),
    };
  } catch (error) {
    if (error instanceof RuntimePointDiagnosticSignal) {
      return { ok: false, stage: error.stage, reason: error.reason };
    }
    return { ok: false, stage: "input", reason: "schema_invalid" };
  }
}

export async function validateProviderRuntimeAttestationPointClosureV1(
  input: ValidateProviderRuntimeAttestationPointClosureV1Input,
): Promise<ProviderRuntimeAttestationPointClosureValidationV1> {
  const diagnostic =
    await diagnoseProviderRuntimeAttestationPointClosureV1(input);
  if (!diagnostic.ok) {
    throw new ProviderRuntimeAttestationPointClosureValidationError();
  }
  return diagnostic.value;
}
