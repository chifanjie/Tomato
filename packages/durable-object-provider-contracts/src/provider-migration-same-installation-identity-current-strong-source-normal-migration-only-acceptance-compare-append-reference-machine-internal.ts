/** Process-local compare-append machine for strict migration-only Acceptance. */

import { z } from "./zod-runtime.js";

import { createDomainPreimageBytesV1 } from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  LowerHex32V1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1Schema,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-reference-candidate-internal.js";
import {
  type ProviderActiveWriterSelectorV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "./provider-strong-ready-acceptance-candidate.js";
import {
  takeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendMigrationHandoffSnapshotInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendMigrationHandoffCapabilityInternalV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-machine-internal.js";
import {
  getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1,
  verifyProviderMigrationOnlyAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import { ProviderRegistryIsoTimestampV1Schema } from "./provider-registry-trust.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedJsonParseV1 = JSON.parse;
const CapturedPromiseResolveV1 = Promise.resolve.bind(Promise);
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapPrototypeDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapPrototypeGetV1 = WeakMap.prototype.get;
const CapturedWeakMapPrototypeSetV1 = WeakMap.prototype.set;

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const arrayPushV1 = bindUncurriedAtBootstrapV1(
  CapturedArrayPrototypePushV1,
) as <T>(array: T[], value: T) => number;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeDeleteV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;

const DURABILITY_V1 =
  "in_memory_reference_only_not_a_durable_provider_v1" as const;
const GENERATION_SET_DOMAIN_V1 =
  "provider-migration-migration-only-acceptance-generation-set-v1";
const CURRENT_VERSION_DOMAIN_V1 =
  "provider-migration-migration-only-acceptance-current-version-v1";
const REQUEST_DOMAIN_V1 =
  "provider-migration-migration-only-acceptance-compare-append-request-v1";
const RECEIPT_DOMAIN_V1 =
  "provider-migration-migration-only-acceptance-compare-append-receipt-v1";

function bytesToLowerHexV1(bytes: Uint8Array): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const byte = bytes[index]!;
    output +=
      alphabet[(byte >>> 4) & 0x0f]! + alphabet[byte & 0x0f]!;
  }
  return output;
}

function digestV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function freezeDetachedCloneV1<T>(value: T): T {
  return deepFreezeProviderPointDetachedDataTreeV1(
    CapturedJsonParseV1(canonicalizeJcsSafeIntegerV1(value)) as T,
  );
}

const AcceptancePinLikeInternalV1Schema = z.strictObject({
  locatorProfile: z.string().min(1),
  acceptanceOrdinal: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  generationId:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1Schema.shape
      .generationId,
  contentDigest: ContentDigestV1Schema,
});
type AcceptancePinLikeInternalV1 = z.infer<
  typeof AcceptancePinLikeInternalV1Schema
>;

const ExpectedInternalV1Schema = z.strictObject({
  highWaterRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  currentAcceptance: AcceptancePinLikeInternalV1Schema,
  currentVersionToken: z.string().min(1),
  generationCount: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  generationSetDigest: ContentDigestV1Schema,
});

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendRequestInternalV1Schema =
  z.strictObject({
    profile: z.literal(
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_compare_append_request_v1",
    ),
    operationNonce: LowerHex32V1Schema,
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    expected: ExpectedInternalV1Schema,
    candidate:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1Schema,
  });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendRequestInternalV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendRequestInternalV1Schema
  >;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReceiptInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_compare_append_receipt_v1";
  readonly durability: typeof DURABILITY_V1;
  readonly operationNonce: string;
  readonly requestContentDigest: ContentDigestV1;
  readonly resolvedAt: string;
  readonly outcome:
    | Readonly<{
        readonly state: "committed";
        readonly appendedAcceptance:
          ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1;
        readonly highWaterRevision: number;
      }>
    | Readonly<{
        readonly state: "not_committed";
        readonly reason: "expected_current_changed";
        readonly observedCurrentAcceptance: AcceptancePinLikeInternalV1;
        readonly observedHighWaterRevision: number;
      }>;
  readonly receiptContentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_compare_append_state_v1";
  readonly durability: typeof DURABILITY_V1;
  readonly installationIdentityGenerationId: string;
  readonly highWaterRevision: number;
  readonly generationCount: number;
  readonly generationSetDigest: ContentDigestV1;
  readonly currentVersionToken: string;
  readonly currentAcceptance: AcceptancePinLikeInternalV1;
  readonly currentRootMetadata:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1["payload"]["configuration"]["core"]["activeRootMetadata"];
  readonly currentRegistryManifest:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1["payload"]["configuration"]["core"]["providerRegistryManifest"];
  readonly currentSupportCatalog:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1["payload"]["configuration"]["core"]["providerSupportCatalog"];
  readonly previousActiveWriterSelector: ProviderActiveWriterSelectorV1;
  readonly migrationOnlyGenerations:
    readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1[];
  readonly receipts:
    readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReceiptInternalV1[];
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1Input {
  readonly identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly strongReadyMigrationHandoffCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendMigrationHandoffCapabilityInternalV1;
}

declare const migrationOnlyAcceptanceMachineBrandInternalV1: unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1 {
  readonly [migrationOnlyAcceptanceMachineBrandInternalV1]: true;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendResultInternalV1 =
  | Readonly<{
      readonly status: "committed";
      readonly replay: boolean;
      readonly receipt:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReceiptInternalV1;
      readonly state:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1;
    }>
  | Readonly<{
      readonly status: "not_committed";
      readonly replay: boolean;
      readonly reason: "expected_current_changed";
      readonly receipt:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReceiptInternalV1;
      readonly state:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        | "capability_invalid"
        | "identity_mismatch"
        | "schema_invalid"
        | "operation_nonce_conflict"
        | "candidate_invalid";
    }>;

interface NonceEntryInternalV1 {
  readonly operationNonce: string;
  readonly requestCanonical: string;
  readonly result:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendResultInternalV1;
}

interface MachineBindingInternalV1 {
  readonly identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  state:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1;
  readonly nonceEntries: NonceEntryInternalV1[];
  tail: Promise<void>;
  lifecycle: "active" | "retired_for_steady";
}

const machineBindingsInternalV1 = new CapturedWeakMapV1<
  object,
  MachineBindingInternalV1
>();

declare const migrationOnlyAcceptanceSteadyHandoffBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffCapabilityInternalV1 {
  readonly [migrationOnlyAcceptanceSteadyHandoffBrandInternalV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffSnapshotInternalV1 {
  readonly installationIdentityGenerationId: string;
  readonly retiredState:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1;
  readonly currentMigrationOnlyAcceptanceEnvelope:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1;
}

interface SteadyHandoffBindingInternalV1 {
  readonly identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly snapshot:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffSnapshotInternalV1;
}

const steadyHandoffBindingsInternalV1 = new CapturedWeakMapV1<
  object,
  SteadyHandoffBindingInternalV1
>();

function strongReadyPinV1(
  envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
): AcceptancePinLikeInternalV1 {
  return CapturedObjectFreezeV1({
    locatorProfile: "installation_provider_acceptance_state_v1",
    acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
  });
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1Input,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1 {
  const identity =
    getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1(
      input.identityVerificationCapability,
    );
  const handoff =
    takeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendMigrationHandoffSnapshotInternalV1(
      input.strongReadyMigrationHandoffCapability,
      input.identityVerificationCapability,
    );
  if (handoff === undefined) {
    throw new CapturedTypeErrorV1(
      "migration-only Acceptance handoff capability invalid",
    );
  }
  const envelope = handoff.currentStrongReadyAcceptanceEnvelope;
  const highWater = handoff.currentStrongReadyHighWater;
  const currentAcceptance = strongReadyPinV1(envelope);
  if (
    identity !== envelope.installationIdentityGenerationId ||
    identity !== highWater.payload.installationIdentityGenerationId ||
    !canonicalEqualV1(currentAcceptance, highWater.payload.currentAcceptance)
  ) {
    throw new CapturedTypeErrorV1(
      "migration-only Acceptance initial identity/current cut invalid",
    );
  }
  const state = deepFreezeProviderPointDetachedDataTreeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_compare_append_state_v1" as const,
    durability: DURABILITY_V1,
    installationIdentityGenerationId: identity,
    highWaterRevision: highWater.payload.highWaterRevision,
    generationCount: highWater.payload.generationCount,
    generationSetDigest: highWater.payload.generationSetDigest,
    currentVersionToken: highWater.currentVersionToken,
    currentAcceptance,
    currentRootMetadata:
      envelope.payload.configuration.core.activeRootMetadata,
    currentRegistryManifest:
      envelope.payload.configuration.core.providerRegistryManifest,
    currentSupportCatalog:
      envelope.payload.configuration.core.providerSupportCatalog,
    previousActiveWriterSelector:
      envelope.payload.configuration.core.activeWriterSelector,
    migrationOnlyGenerations: [],
    receipts: [],
  });
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  weakMapSetV1(machineBindingsInternalV1, capability, {
    identityVerificationCapability: input.identityVerificationCapability,
    state,
    nonceEntries: [],
    tail: CapturedPromiseResolveV1(undefined),
    lifecycle: "active",
  });
  return capability;
}

function rejectedV1(
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendResultInternalV1,
    { readonly status: "rejected" }
  >["reason"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendResultInternalV1 {
  return CapturedObjectFreezeV1({ status: "rejected", reason });
}

function requestExpectedMatchesV1(
  state: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendRequestInternalV1,
): boolean {
  return request.expected.highWaterRevision === state.highWaterRevision &&
    request.expected.generationCount === state.generationCount &&
    request.expected.generationSetDigest === state.generationSetDigest &&
    request.expected.currentVersionToken === state.currentVersionToken &&
    canonicalEqualV1(
      request.expected.currentAcceptance,
      state.currentAcceptance,
    );
}

function candidateMatchesCurrentV1(
  state: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1,
  candidate: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1,
): boolean {
  const configuration = candidate.payload.configuration;
  return candidate.installationIdentityGenerationId ===
      state.installationIdentityGenerationId &&
    candidate.payload.acceptanceOrdinal ===
      state.currentAcceptance.acceptanceOrdinal + 1 &&
    candidate.payload.predecessor.generationId ===
      state.currentAcceptance.generationId &&
    candidate.payload.predecessor.contentDigest ===
      state.currentAcceptance.contentDigest &&
    canonicalEqualV1(
      configuration.publishedTrustPins.rootMetadata,
      state.currentRootMetadata,
    ) &&
    configuration.publishedTrustPins.registryManifest.manifestGeneration >=
      state.currentRegistryManifest.manifestGeneration &&
    configuration.publishedTrustPins.supportCatalog.catalogGeneration >=
      state.currentSupportCatalog.catalogGeneration &&
    canonicalEqualV1(
      configuration.publicStrongWriter.previousActiveWriterSelector,
      state.previousActiveWriterSelector,
    );
}

function createReceiptV1(
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendRequestInternalV1,
  resolvedAt: string,
  outcome:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReceiptInternalV1["outcome"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReceiptInternalV1 {
  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_compare_append_receipt_v1" as const,
    durability: DURABILITY_V1,
    operationNonce: request.operationNonce,
    requestContentDigest: digestV1(REQUEST_DOMAIN_V1, request),
    resolvedAt,
    outcome,
  };
  return deepFreezeProviderPointDetachedDataTreeV1({
    ...unsigned,
    receiptContentDigest: digestV1(RECEIPT_DOMAIN_V1, unsigned),
  });
}

async function compareAppendLinearizedInternalV1(
  binding: MachineBindingInternalV1,
  input: Readonly<{
    identityVerificationCapability:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
    request:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendRequestInternalV1;
    resolvedAt: string;
  }>,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendResultInternalV1> {
  if (binding.lifecycle !== "active") {
    return rejectedV1("capability_invalid");
  }
  const identity =
    getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1(
      input.identityVerificationCapability,
    );
  if (identity !== binding.state.installationIdentityGenerationId) {
    return rejectedV1("identity_mismatch");
  }
  const parsed =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendRequestInternalV1Schema.safeParse(
      input.request,
    );
  const resolvedAt = ProviderRegistryIsoTimestampV1Schema.safeParse(
    input.resolvedAt,
  );
  if (!parsed.success || !resolvedAt.success) {
    return rejectedV1("schema_invalid");
  }
  const request = deepFreezeProviderPointDetachedDataTreeV1(parsed.data);
  if (request.installationIdentityGenerationId !== identity) {
    return rejectedV1("identity_mismatch");
  }
  const requestCanonical = canonicalizeJcsSafeIntegerV1(request);
  for (let index = 0; index < binding.nonceEntries.length; index += 1) {
    const existing = binding.nonceEntries[index]!;
    if (existing.operationNonce !== request.operationNonce) continue;
    if (existing.requestCanonical !== requestCanonical) {
      return rejectedV1("operation_nonce_conflict");
    }
    if (existing.result.status === "rejected") return existing.result;
    return CapturedObjectFreezeV1({
      ...existing.result,
      replay: true,
    });
  }
  const before = binding.state;
  if (!requestExpectedMatchesV1(before, request)) {
    const receipt = createReceiptV1(request, resolvedAt.data, {
      state: "not_committed",
      reason: "expected_current_changed",
      observedCurrentAcceptance: before.currentAcceptance,
      observedHighWaterRevision: before.highWaterRevision,
    });
    const state = freezeDetachedCloneV1({
      ...before,
      receipts: [...before.receipts, receipt],
    });
    binding.state = state;
    const result = CapturedObjectFreezeV1({
      status: "not_committed" as const,
      replay: false,
      reason: "expected_current_changed" as const,
      receipt,
      state,
    });
    arrayPushV1(binding.nonceEntries, {
      operationNonce: request.operationNonce,
      requestCanonical,
      result,
    });
    return result;
  }
  if (!candidateMatchesCurrentV1(before, request.candidate)) {
    return rejectedV1("candidate_invalid");
  }
  const { acceptanceToken, ...unsignedAcceptance } =
    request.candidate.payload;
  let tokenValid = false;
  try {
    tokenValid =
      await verifyProviderMigrationOnlyAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        input.identityVerificationCapability,
        identity,
        unsignedAcceptance,
        acceptanceToken,
      );
  } catch {
    tokenValid = false;
  }
  if (!tokenValid) return rejectedV1("candidate_invalid");
  const pin =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1(
      request.candidate,
    );
  const highWaterRevision = before.highWaterRevision + 1;
  const generationCount = before.generationCount + 1;
  const generationSetDigest = digestV1(GENERATION_SET_DOMAIN_V1, {
    predecessorGenerationSetDigest: before.generationSetDigest,
    generationCount,
    currentAcceptance: pin,
  });
  const currentVersionToken = digestV1(CURRENT_VERSION_DOMAIN_V1, {
    installationIdentityGenerationId: identity,
    highWaterRevision,
    generationCount,
    generationSetDigest,
    currentAcceptance: pin,
  });
  const receipt = createReceiptV1(request, resolvedAt.data, {
    state: "committed",
    appendedAcceptance: pin,
    highWaterRevision,
  });
  const state = freezeDetachedCloneV1({
    ...before,
    highWaterRevision,
    generationCount,
    generationSetDigest,
    currentVersionToken,
    currentAcceptance: pin,
    currentRootMetadata:
      request.candidate.payload.configuration.publishedTrustPins.rootMetadata,
    currentRegistryManifest:
      request.candidate.payload.configuration.publishedTrustPins
        .registryManifest,
    currentSupportCatalog:
      request.candidate.payload.configuration.publishedTrustPins
        .supportCatalog,
    migrationOnlyGenerations: [
      ...before.migrationOnlyGenerations,
      request.candidate,
    ],
    receipts: [...before.receipts, receipt],
  });
  binding.state = state;
  const result = CapturedObjectFreezeV1({
    status: "committed" as const,
    replay: false,
    receipt,
    state,
  });
  arrayPushV1(binding.nonceEntries, {
    operationNonce: request.operationNonce,
    requestCanonical,
    result,
  });
  return result;
}

export function compareAppendProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceMachineInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
  input: Readonly<{
    identityVerificationCapability:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
    request:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendRequestInternalV1;
    resolvedAt: string;
  }>,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendResultInternalV1> {
  if (capability === null || typeof capability !== "object") {
    return CapturedPromiseResolveV1(rejectedV1("capability_invalid"));
  }
  const binding = weakMapGetV1(machineBindingsInternalV1, capability);
  if (
    binding === undefined ||
    binding.lifecycle !== "active" ||
    binding.identityVerificationCapability !==
      input.identityVerificationCapability
  ) {
    return CapturedPromiseResolveV1(rejectedV1("capability_invalid"));
  }
  const operation = binding.tail.then(() =>
    compareAppendLinearizedInternalV1(binding, input)
  );
  binding.tail = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

/**
 * Queue-linearized, irreversible transfer from the migration-only Acceptance
 * branch into the terminal destination-strong-ready branch. Once committed,
 * the old migration-only writer rejects every later append, including replay.
 */
export function retireProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceMachineForSteadyInternalV1(
  input: Readonly<{
    identityVerificationCapability:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
    referenceMachineCapability:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
    expectedState:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1;
  }>,
): Promise<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffCapabilityInternalV1 | undefined
> {
  if (
    input === null ||
    typeof input !== "object" ||
    input.referenceMachineCapability === null ||
    typeof input.referenceMachineCapability !== "object"
  ) return CapturedPromiseResolveV1(undefined);
  const binding = weakMapGetV1(
    machineBindingsInternalV1,
    input.referenceMachineCapability,
  );
  if (
    binding === undefined ||
    binding.lifecycle !== "active" ||
    binding.identityVerificationCapability !==
      input.identityVerificationCapability
  ) return CapturedPromiseResolveV1(undefined);
  const identity =
    getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1(
      input.identityVerificationCapability,
    );
  let expectedState:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1;
  try {
    expectedState = freezeDetachedCloneV1(input.expectedState);
  } catch {
    return CapturedPromiseResolveV1(undefined);
  }
  const operation = binding.tail.then(() => {
    if (
      binding.lifecycle !== "active" ||
      identity !== binding.state.installationIdentityGenerationId ||
      !canonicalEqualV1(binding.state, expectedState)
    ) return undefined;
    const envelope =
      binding.state.migrationOnlyGenerations[
        binding.state.migrationOnlyGenerations.length - 1
      ];
    if (
      envelope === undefined ||
      envelope.installationIdentityGenerationId !== identity ||
      !canonicalEqualV1(
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1(
          envelope,
        ),
        binding.state.currentAcceptance,
      )
    ) return undefined;
    const snapshot = freezeDetachedCloneV1({
      installationIdentityGenerationId: identity,
      retiredState: binding.state,
      currentMigrationOnlyAcceptanceEnvelope: envelope,
    });
    const capability = CapturedObjectFreezeV1(
      CapturedObjectCreateV1(null),
    ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffCapabilityInternalV1;
    binding.lifecycle = "retired_for_steady";
    weakMapSetV1(steadyHandoffBindingsInternalV1, capability, {
      identityVerificationCapability: input.identityVerificationCapability,
      snapshot,
    });
    return capability;
  });
  binding.tail = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

/** Exact-once handoff; a foreign identity capability does not burn it. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffSnapshotInternalV1(
  handoffCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffCapabilityInternalV1,
  identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffSnapshotInternalV1 | undefined {
  if (handoffCapability === null || typeof handoffCapability !== "object") {
    return undefined;
  }
  const binding = weakMapGetV1(
    steadyHandoffBindingsInternalV1,
    handoffCapability,
  );
  if (
    binding === undefined ||
    binding.identityVerificationCapability !== identityVerificationCapability
  ) return undefined;
  if (!weakMapDeleteV1(steadyHandoffBindingsInternalV1, handoffCapability)) {
    return undefined;
  }
  return binding.snapshot;
}

export function inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1 {
  if (capability === null || typeof capability !== "object") {
    throw new CapturedTypeErrorV1(
      "migration-only Acceptance machine capability invalid",
    );
  }
  const binding = weakMapGetV1(machineBindingsInternalV1, capability);
  if (binding === undefined) {
    throw new CapturedTypeErrorV1(
      "migration-only Acceptance machine capability invalid",
    );
  }
  return binding.state;
}

for (const exportedFunctionV1 of [
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1,
  compareAppendProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceMachineInternalV1,
  retireProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceMachineForSteadyInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffSnapshotInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
