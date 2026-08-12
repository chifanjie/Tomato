import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
  createDomainPreimageBytesV1,
  deriveKeyedStateTokenForDomainV1,
  type ProviderCryptoHostV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  ProviderAcceptanceStateGenerationIdV1Schema,
  ProviderTargetProfileIdV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  diagnoseProviderDistributionHistoryCurrentCandidatePointV1,
  type ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "./provider-distribution-history-current-candidate-point.js";
import {
  ProviderFeasibilitySupportCatalogPinV1Schema,
} from "./provider-feasibility-support-catalog-point.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  ProviderFeasibilityEvidencePinV1Schema,
  ProviderRegistryManifestPinV1Schema,
} from "./provider-registry-records.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
} from "./provider-registry-trust.js";
import {
  deriveProviderStrongReadyActiveWriterSelectionsInternalV1,
  ProviderStrongReadyActiveWriterSelectionErrorInternalV1,
} from "./provider-strong-ready-acceptance-candidate-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedMathMinV1 = Math.min;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectGetOwnPropertySymbolsV1 = Object.getOwnPropertySymbols;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectKeysV1 = Object.keys;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedStringPrototypeCharCodeAtV1 = String.prototype.charCodeAt;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedUint8ArrayPrototypeSliceV1 = Uint8Array.prototype.slice;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

function bindUncurriedAcceptanceIntrinsicV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const stringCharCodeAtV1 = bindUncurriedAcceptanceIntrinsicV1(
  CapturedStringPrototypeCharCodeAtV1,
) as (receiver: string, index: number) => number;
const uint8ArraySliceV1 = bindUncurriedAcceptanceIntrinsicV1(
  CapturedUint8ArrayPrototypeSliceV1,
) as (receiver: Uint8Array, start?: number, end?: number) => Uint8Array;
const weakSetAddV1 = bindUncurriedAcceptanceIntrinsicV1(
  CapturedWeakSetPrototypeAddV1,
) as <T extends object>(receiver: WeakSet<T>, value: T) => WeakSet<T>;
const weakSetHasV1 = bindUncurriedAcceptanceIntrinsicV1(
  CapturedWeakSetPrototypeHasV1,
) as <T extends object>(receiver: WeakSet<T>, value: T) => boolean;

export const PROVIDER_ACTIVE_WRITER_SELECTOR_DOMAIN_V1 =
  "provider-active-writer-selector-v1" as const;
export const PROVIDER_ACCEPTANCE_STATE_GENERATION_ID_DOMAIN_V1 =
  "provider-acceptance-state-generation-id-v1" as const;
export const PROVIDER_ACCEPTANCE_STATE_DOMAIN_V1 =
  "provider-acceptance-state-v1" as const;
export const PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1 =
  "provider-acceptance-state-token-v1" as const;
export const PROVIDER_STRONG_READY_ACCEPTANCE_CANDIDATE_AUTHORITY_V1 =
  "none_provider_strong_ready_acceptance_candidate_structure_only" as const;

const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

function textEncoderEncodeV1(value: string): Uint8Array {
  return CapturedReflectApplyV1(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [value],
  ) as Uint8Array;
}

function compareUtf8V1(left: string, right: string): number {
  const leftBytes = textEncoderEncodeV1(left);
  const rightBytes = textEncoderEncodeV1(right);
  const length = CapturedMathMinV1(
    leftBytes.byteLength,
    rightBytes.byteLength,
  );
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.byteLength - rightBytes.byteLength;
}

export const ProviderActiveWriterSelectionV1Schema = z.strictObject({
  targetProfileId: ProviderTargetProfileIdV1Schema,
  providerId: DurableObjectIdentityProviderIdV1Schema,
  registryEntryContentDigest: ContentDigestV1Schema,
  semanticProviderPolicyDigest: ContentDigestV1Schema,
  providerFeasibilityEvidence: ProviderFeasibilityEvidencePinV1Schema,
  runtimeAttestationContentDigest: ContentDigestV1Schema,
  bindingDerivationKeyGeneration: PositiveSafeIntegerV1Schema,
});
export type ProviderActiveWriterSelectionV1 = z.infer<
  typeof ProviderActiveWriterSelectionV1Schema
>;

export const ProviderActiveWriterSelectorV1Schema = z
  .strictObject({
    profile: z.literal("provider_active_writer_selector_v1"),
    selections: z.array(ProviderActiveWriterSelectionV1Schema).min(1).max(4096),
  })
  .superRefine((selector, context) => {
    for (let index = 1; index < selector.selections.length; index += 1) {
      if (
        compareUtf8V1(
          selector.selections[index - 1]!.targetProfileId,
          selector.selections[index]!.targetProfileId,
        ) >= 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["selections", index, "targetProfileId"],
          message:
            "active-writer selections must be UTF-8 bytewise sorted and unique by targetProfileId",
        });
      }
    }
  });
export type ProviderActiveWriterSelectorV1 = z.infer<
  typeof ProviderActiveWriterSelectorV1Schema
>;

export const ProviderMigrationStrongReadyCoreV1Schema = z.strictObject({
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  providerRegistryManifest: ProviderRegistryManifestPinV1Schema,
  providerSupportCatalog: ProviderFeasibilitySupportCatalogPinV1Schema,
  activeWriterSelector: ProviderActiveWriterSelectorV1Schema,
});
export type ProviderMigrationStrongReadyCoreV1 = z.infer<
  typeof ProviderMigrationStrongReadyCoreV1Schema
>;

export const ProviderStrongReadyBootstrapOrSteadyActivationV1Schema =
  z.strictObject({
    origin: z.literal("bootstrap_or_steady_successor"),
  });
export type ProviderStrongReadyBootstrapOrSteadyActivationV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyActivationV1Schema
>;

export const ProviderStrongReadyAcceptedConfigurationCandidateV1Schema =
  z.strictObject({
    state: z.literal("strong_ready"),
    core: ProviderMigrationStrongReadyCoreV1Schema,
    activation: ProviderStrongReadyBootstrapOrSteadyActivationV1Schema,
  });
export type ProviderStrongReadyAcceptedConfigurationCandidateV1 = z.infer<
  typeof ProviderStrongReadyAcceptedConfigurationCandidateV1Schema
>;

export const ProviderAcceptanceGenesisPredecessorV1Schema = z.strictObject({
  state: z.literal("genesis"),
});
export const ProviderAcceptanceGenerationPredecessorV1Schema = z.strictObject({
  state: z.literal("acceptance"),
  generationId: ProviderAcceptanceStateGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export const ProviderAcceptancePredecessorV1Schema = z.discriminatedUnion(
  "state",
  [
    ProviderAcceptanceGenesisPredecessorV1Schema,
    ProviderAcceptanceGenerationPredecessorV1Schema,
  ],
);
export type ProviderAcceptancePredecessorV1 = z.infer<
  typeof ProviderAcceptancePredecessorV1Schema
>;

export const ProviderStrongReadyAcceptanceStateGenerationIdFieldsV1Schema =
  z.strictObject({
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    acceptanceOrdinal: PositiveSafeIntegerV1Schema,
    predecessor: ProviderAcceptancePredecessorV1Schema,
    configuration:
      ProviderStrongReadyAcceptedConfigurationCandidateV1Schema,
  });
export type ProviderStrongReadyAcceptanceStateGenerationIdFieldsV1 = z.infer<
  typeof ProviderStrongReadyAcceptanceStateGenerationIdFieldsV1Schema
>;

const StrongReadyAcceptanceStateUnsignedShapeV1 = {
  profile: z.literal("provider_acceptance_state_v1"),
  generationId: ProviderAcceptanceStateGenerationIdV1Schema,
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  acceptanceOrdinal: PositiveSafeIntegerV1Schema,
  predecessor: ProviderAcceptancePredecessorV1Schema,
  configuration: ProviderStrongReadyAcceptedConfigurationCandidateV1Schema,
  acceptedAt: ProviderRegistryIsoTimestampV1Schema,
} as const;

export const ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema =
  z.strictObject(StrongReadyAcceptanceStateUnsignedShapeV1);
export type ProviderStrongReadyAcceptanceStateUnsignedCandidateV1 = z.infer<
  typeof ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema
>;

export const ProviderStrongReadyAcceptanceStateCandidateV1Schema =
  z.strictObject({
    ...StrongReadyAcceptanceStateUnsignedShapeV1,
    acceptanceToken: KeyedStateTokenV1Schema,
  });
export type ProviderStrongReadyAcceptanceStateCandidateV1 = z.infer<
  typeof ProviderStrongReadyAcceptanceStateCandidateV1Schema
>;

export const ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal("provider_acceptance_state"),
    generationId: ProviderAcceptanceStateGenerationIdV1Schema,
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    acceptedAt: ProviderRegistryIsoTimestampV1Schema,
    contentDigest: ContentDigestV1Schema,
    payload: ProviderStrongReadyAcceptanceStateCandidateV1Schema,
  });
export type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1 = z.infer<
  typeof ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema
>;

export const ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema =
  z.strictObject({
    locatorProfile: z.literal("installation_provider_acceptance_state_v1"),
    acceptanceOrdinal: PositiveSafeIntegerV1Schema,
    generationId: ProviderAcceptanceStateGenerationIdV1Schema,
    contentDigest: ContentDigestV1Schema,
  });
export type ProviderStrongReadyAcceptanceGenerationPinCandidateV1 = z.infer<
  typeof ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema
>;

export const ProviderStrongReadyAcceptanceCandidateValidationV1Schema =
  z.strictObject({
    authority: z.literal(
      PROVIDER_STRONG_READY_ACCEPTANCE_CANDIDATE_AUTHORITY_V1,
    ),
    activeWriterSelector: ProviderActiveWriterSelectorV1Schema,
    activeWriterSelectorContentDigest: ContentDigestV1Schema,
    acceptanceStateEnvelope:
      ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
    acceptanceGenerationPin:
      ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  });
export type ProviderStrongReadyAcceptanceCandidateValidationV1 = z.infer<
  typeof ProviderStrongReadyAcceptanceCandidateValidationV1Schema
>;

export const ProviderStrongReadyAcceptanceCandidateInvalidStageV1Schema =
  z.enum([
    "input",
    "distribution_history_candidate",
    "active_writer_selector",
    "acceptance_state",
  ]);
export type ProviderStrongReadyAcceptanceCandidateInvalidStageV1 = z.infer<
  typeof ProviderStrongReadyAcceptanceCandidateInvalidStageV1Schema
>;

export const ProviderStrongReadyAcceptanceCandidateInvalidReasonV1Schema =
  z.enum([
    "schema_invalid",
    "source_invalid",
    "routing_not_steady",
    "selector_zero_match",
    "selector_ambiguous_match",
    "selector_mismatch",
    "generation_mismatch",
    "digest_mismatch",
    "token_invalid",
    "envelope_mismatch",
  ]);
export type ProviderStrongReadyAcceptanceCandidateInvalidReasonV1 = z.infer<
  typeof ProviderStrongReadyAcceptanceCandidateInvalidReasonV1Schema
>;

interface StrongReadyAcceptanceCandidateDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderStrongReadyAcceptanceCandidateInvalidStageV1;
  readonly reason: ProviderStrongReadyAcceptanceCandidateInvalidReasonV1;
}

interface StrongReadyAcceptanceCandidateDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderStrongReadyAcceptanceCandidateValidationV1;
}

export type ProviderStrongReadyAcceptanceCandidateDiagnosticResultV1 =
  | StrongReadyAcceptanceCandidateDiagnosticFailureV1
  | StrongReadyAcceptanceCandidateDiagnosticSuccessV1;

export interface CreateProviderStrongReadyAcceptanceCandidateV1Input {
  readonly distributionHistoryCandidate:
    ValidateProviderDistributionHistoryCurrentCandidatePointV1Input;
  readonly acceptanceOrdinal: number;
  readonly predecessor: ProviderAcceptancePredecessorV1;
  readonly acceptedAt: z.infer<typeof ProviderRegistryIsoTimestampV1Schema>;
  readonly installationIdentityKey: Uint8Array;
  readonly cryptoHost: ProviderCryptoHostV1;
}

export interface ValidateProviderStrongReadyAcceptanceCandidateV1Input {
  readonly distributionHistoryCandidate:
    ValidateProviderDistributionHistoryCurrentCandidatePointV1Input;
  readonly acceptanceStateEnvelope:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
  readonly installationIdentityKey: Uint8Array;
  readonly cryptoHost: ProviderCryptoHostV1;
}

export class ProviderStrongReadyAcceptanceCandidateValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider strong-ready Acceptance candidate validation failed");
    this.name = "ProviderStrongReadyAcceptanceCandidateValidationError";
    CapturedObjectFreezeV1(this);
  }
}

class StrongReadyAcceptanceCandidateDiagnosticSignalV1 extends Error {
  constructor(
    readonly stage: ProviderStrongReadyAcceptanceCandidateInvalidStageV1,
    readonly reason: ProviderStrongReadyAcceptanceCandidateInvalidReasonV1,
  ) {
    super("provider strong-ready Acceptance candidate diagnostic");
    weakSetAddV1(StrongReadyAcceptanceCandidateDiagnosticSignalsV1, this);
  }
}

const StrongReadyAcceptanceCandidateDiagnosticSignalsV1 =
  new CapturedWeakSetV1<object>();

function isDiagnosticSignalV1(
  value: unknown,
): value is StrongReadyAcceptanceCandidateDiagnosticSignalV1 {
  return typeof value === "object" && value !== null &&
    weakSetHasV1(StrongReadyAcceptanceCandidateDiagnosticSignalsV1, value);
}

function failV1(
  stage: ProviderStrongReadyAcceptanceCandidateInvalidStageV1,
  reason: ProviderStrongReadyAcceptanceCandidateInvalidReasonV1,
): never {
  throw new StrongReadyAcceptanceCandidateDiagnosticSignalV1(stage, reason);
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const byte = bytes[index]!;
    output +=
      alphabet[(byte >>> 4) & 0x0f]! +
      alphabet[byte & 0x0f]!;
  }
  return output;
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

function shortHexForDomainV1(domain: string, fields: object): string {
  const digest = sha256InternalV1(
    createDomainPreimageBytesV1(domain, fields),
  );
  return bytesToLowerHexV1(
    uint8ArraySliceV1(digest, 0, 11),
  );
}

function parseJsonFieldsV1<T>(schema: z.ZodType<T>, input: unknown): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  return schema.parse(input);
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

function fixedLengthStringEqualV1(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |=
      stringCharCodeAtV1(left, index) ^ stringCharCodeAtV1(right, index);
  }
  return difference === 0;
}

function projectUnsignedAcceptanceStateV1(
  input: unknown,
): ProviderStrongReadyAcceptanceStateUnsignedCandidateV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed =
    ProviderStrongReadyAcceptanceStateCandidateV1Schema.safeParse(input);
  if (signed.success) {
    const { acceptanceToken: _acceptanceToken, ...unsigned } = signed.data;
    return ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema.parse(
      unsigned,
    );
  }
  return ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema.parse(
    input,
  );
}

export function deriveProviderActiveWriterSelectorContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  const selector = parseJsonFieldsV1(
    ProviderActiveWriterSelectorV1Schema,
    input,
  );
  return digestForDomainV1(PROVIDER_ACTIVE_WRITER_SELECTOR_DOMAIN_V1, selector);
}

export function deriveProviderStrongReadyAcceptanceStateGenerationIdV1(
  input: unknown,
): z.infer<typeof ProviderAcceptanceStateGenerationIdV1Schema> {
  const fields = parseJsonFieldsV1(
    ProviderStrongReadyAcceptanceStateGenerationIdFieldsV1Schema,
    input,
  );
  return ProviderAcceptanceStateGenerationIdV1Schema.parse(
    `provider-acceptance-state:${shortHexForDomainV1(
      PROVIDER_ACCEPTANCE_STATE_GENERATION_ID_DOMAIN_V1,
      fields,
    )}`,
  );
}

export function deriveProviderStrongReadyAcceptanceStateContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_ACCEPTANCE_STATE_DOMAIN_V1,
    projectUnsignedAcceptanceStateV1(input),
  );
}

export function deriveProviderStrongReadyAcceptanceStateTokenV1(
  input: unknown,
  installationIdentityKey: Uint8Array,
  cryptoHost: ProviderCryptoHostV1,
): Promise<z.infer<typeof KeyedStateTokenV1Schema>> {
  const unsigned = projectUnsignedAcceptanceStateV1(input);
  return hardenProviderPointPromiseV1(
    deriveKeyedStateTokenForDomainV1(
      cryptoHost,
      installationIdentityKey,
      PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
      unsigned,
    ),
  );
}

const CREATE_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "acceptanceOrdinal",
  "acceptedAt",
  "cryptoHost",
  "distributionHistoryCandidate",
  "installationIdentityKey",
  "predecessor",
] as const);

const VALIDATE_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "acceptanceStateEnvelope",
  "cryptoHost",
  "distributionHistoryCandidate",
  "installationIdentityKey",
] as const);

function sortedKeysV1(value: object): string[] {
  const keys = CapturedObjectKeysV1(value);
  return CapturedReflectApplyV1(CapturedArrayPrototypeSortV1, keys, [
    undefined,
  ]) as string[];
}

function captureExactTopLevelV1(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  if (
    CapturedObjectGetPrototypeOfV1(input) !== CapturedObjectPrototypeV1 &&
    CapturedObjectGetPrototypeOfV1(input) !== null
  ) {
    throw new CapturedTypeErrorV1("candidate input must be a plain object");
  }
  if (CapturedObjectGetOwnPropertySymbolsV1(input).length !== 0) {
    throw new CapturedTypeErrorV1("candidate input must not contain symbols");
  }
  const descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(input);
  const keys = sortedKeysV1(descriptors);
  if (keys.length !== expectedKeys.length) {
    throw new CapturedTypeErrorV1("candidate input key set is invalid");
  }
  const captured: Record<string, unknown> = CapturedObjectCreateV1(null);
  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index]!;
    if (keys[index] !== key) {
      throw new CapturedTypeErrorV1("candidate input key set is invalid");
    }
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new CapturedTypeErrorV1(
        "candidate input requires enumerable data properties",
      );
    }
    captured[key] = descriptor.value;
  }
  return CapturedObjectFreezeV1(captured);
}

function captureCryptoHostV1(input: unknown): ProviderCryptoHostV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(input);
  const keys = sortedKeysV1(descriptors);
  if (
    keys.length !== 2 ||
    keys[0] !== "hmacSha256" ||
    keys[1] !== "sha256"
  ) {
    throw new CapturedTypeErrorV1("cryptoHost key set is invalid");
  }
  const hmacDescriptor = descriptors.hmacSha256;
  const shaDescriptor = descriptors.sha256;
  if (
    hmacDescriptor === undefined ||
    shaDescriptor === undefined ||
    !("value" in hmacDescriptor) ||
    !("value" in shaDescriptor) ||
    hmacDescriptor.enumerable !== true ||
    shaDescriptor.enumerable !== true ||
    typeof hmacDescriptor.value !== "function" ||
    typeof shaDescriptor.value !== "function"
  ) {
    throw new CapturedTypeErrorV1("cryptoHost methods are invalid");
  }
  const receiver = input as object;
  const hmacSha256 = hmacDescriptor.value as Function;
  const sha256 = shaDescriptor.value as Function;
  return CapturedObjectFreezeV1({
    sha256(message: Uint8Array) {
      return CapturedReflectApplyV1(sha256, receiver, [message]);
    },
    hmacSha256(key: Uint8Array, message: Uint8Array) {
      return CapturedReflectApplyV1(hmacSha256, receiver, [key, message]);
    },
  });
}

function captureInstallationIdentityKeyV1(input: unknown): Uint8Array {
  if (!(input instanceof CapturedUint8ArrayV1) || input.byteLength !== 32) {
    throw new CapturedTypeErrorV1(
      "installationIdentityKey must be exactly 32 bytes",
    );
  }
  return uint8ArraySliceV1(input);
}

interface PreparedIdentityProofV1 {
  readonly key: Uint8Array;
  readonly cryptoHost: ProviderCryptoHostV1;
}

interface PreparedCreateInputV1 {
  readonly distributionHistoryCandidate: unknown;
  readonly acceptanceOrdinal: number;
  readonly predecessor: ProviderAcceptancePredecessorV1;
  readonly acceptedAt: z.infer<typeof ProviderRegistryIsoTimestampV1Schema>;
  readonly identityProof: PreparedIdentityProofV1;
}

interface PreparedValidateInputV1 {
  readonly distributionHistoryCandidate: unknown;
  readonly acceptanceStateEnvelope:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
  readonly identityProof: PreparedIdentityProofV1;
}

function prepareIdentityProofV1(
  fields: Readonly<Record<string, unknown>>,
): PreparedIdentityProofV1 {
  return CapturedObjectFreezeV1({
    key: captureInstallationIdentityKeyV1(
      fields.installationIdentityKey,
    ),
    cryptoHost: captureCryptoHostV1(fields.cryptoHost),
  });
}

function assertOrdinalPredecessorV1(
  acceptanceOrdinal: number,
  predecessor: ProviderAcceptancePredecessorV1,
): void {
  if (
    (acceptanceOrdinal === 1 && predecessor.state !== "genesis") ||
    (acceptanceOrdinal > 1 && predecessor.state !== "acceptance")
  ) {
    return failV1("acceptance_state", "generation_mismatch");
  }
}

function prepareCreateInputV1(input: unknown): PreparedCreateInputV1 {
  const fields = captureExactTopLevelV1(input, CREATE_INPUT_KEYS_V1);
  const acceptanceOrdinal = PositiveSafeIntegerV1Schema.parse(
    fields.acceptanceOrdinal,
  );
  const predecessor = parseJsonFieldsV1(
    ProviderAcceptancePredecessorV1Schema,
    fields.predecessor,
  );
  assertOrdinalPredecessorV1(acceptanceOrdinal, predecessor);
  return CapturedObjectFreezeV1({
    distributionHistoryCandidate: fields.distributionHistoryCandidate,
    acceptanceOrdinal,
    predecessor,
    acceptedAt: ProviderRegistryIsoTimestampV1Schema.parse(fields.acceptedAt),
    identityProof: prepareIdentityProofV1(fields),
  });
}

function prepareValidateInputV1(input: unknown): PreparedValidateInputV1 {
  const fields = captureExactTopLevelV1(input, VALIDATE_INPUT_KEYS_V1);
  const acceptanceStateEnvelope = parseJsonFieldsV1(
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
    fields.acceptanceStateEnvelope,
  );
  assertOrdinalPredecessorV1(
    acceptanceStateEnvelope.payload.acceptanceOrdinal,
    acceptanceStateEnvelope.payload.predecessor,
  );
  return CapturedObjectFreezeV1({
    distributionHistoryCandidate: fields.distributionHistoryCandidate,
    acceptanceStateEnvelope,
    identityProof: prepareIdentityProofV1(fields),
  });
}

async function buildExpectedCandidateV1(
  distributionHistoryCandidate: unknown,
  acceptanceOrdinal: number,
  predecessor: ProviderAcceptancePredecessorV1,
  acceptedAt: z.infer<typeof ProviderRegistryIsoTimestampV1Schema>,
  identityProof: PreparedIdentityProofV1,
): Promise<ProviderStrongReadyAcceptanceCandidateValidationV1> {
  let distributionDiagnostic;
  try {
    distributionDiagnostic =
      await diagnoseProviderDistributionHistoryCurrentCandidatePointV1(
        distributionHistoryCandidate,
      );
  } catch {
    return failV1("distribution_history_candidate", "source_invalid");
  }
  if (!distributionDiagnostic.ok) {
    return failV1("distribution_history_candidate", "source_invalid");
  }
  const distribution = distributionDiagnostic.value;
  const registryClosure =
    distribution.catalogPointClosure.registryManifestHistoryClosure;

  let selections: readonly ProviderActiveWriterSelectionV1[];
  try {
    selections =
      deriveProviderStrongReadyActiveWriterSelectionsInternalV1(distribution);
  } catch (error) {
    if (
      error instanceof
      ProviderStrongReadyActiveWriterSelectionErrorInternalV1
    ) {
      const reason = error.reason === "routing_not_steady"
        ? "routing_not_steady"
        : error.reason === "zero_match"
        ? "selector_zero_match"
        : error.reason === "ambiguous_match"
        ? "selector_ambiguous_match"
        : "source_invalid";
      return failV1("active_writer_selector", reason);
    }
    return failV1("active_writer_selector", "source_invalid");
  }

  const activeWriterSelector = ProviderActiveWriterSelectorV1Schema.parse({
    profile: "provider_active_writer_selector_v1",
    selections,
  });
  const activeWriterSelectorContentDigest =
    deriveProviderActiveWriterSelectorContentDigestV1(activeWriterSelector);
  const configuration =
    ProviderStrongReadyAcceptedConfigurationCandidateV1Schema.parse({
      state: "strong_ready",
      core: {
        activeRootMetadata: registryClosure.currentRootMetadata,
        providerRegistryManifest: registryClosure.currentRegistryManifest,
        providerSupportCatalog:
          distribution.catalogPointClosure
            .providerFeasibilitySupportCatalogPin,
        activeWriterSelector,
      },
      activation: { origin: "bootstrap_or_steady_successor" },
    });
  const generationId =
    deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
      installationIdentityGenerationId:
        registryClosure.installationIdentityGenerationId,
      acceptanceOrdinal,
      predecessor,
      configuration,
    });
  const unsignedState =
    ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema.parse({
      profile: "provider_acceptance_state_v1",
      generationId,
      installationIdentityGenerationId:
        registryClosure.installationIdentityGenerationId,
      acceptanceOrdinal,
      predecessor,
      configuration,
      acceptedAt,
    });
  let acceptanceToken;
  try {
    acceptanceToken =
      await deriveProviderStrongReadyAcceptanceStateTokenV1(
        unsignedState,
        identityProof.key,
        identityProof.cryptoHost,
      );
  } catch {
    return failV1("acceptance_state", "source_invalid");
  }
  const acceptanceState =
    ProviderStrongReadyAcceptanceStateCandidateV1Schema.parse({
      ...unsignedState,
      acceptanceToken,
    });
  const contentDigest =
    deriveProviderStrongReadyAcceptanceStateContentDigestV1(acceptanceState);
  const acceptanceStateEnvelope =
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_acceptance_state",
      generationId,
      installationIdentityGenerationId:
        registryClosure.installationIdentityGenerationId,
      acceptedAt,
      contentDigest,
      payload: acceptanceState,
    });
  const acceptanceGenerationPin =
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse({
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal,
      generationId,
      contentDigest,
    });
  deepFreezeProviderPointDetachedDataTreeV1(activeWriterSelector);
  deepFreezeProviderPointDetachedDataTreeV1(acceptanceStateEnvelope);
  deepFreezeProviderPointDetachedDataTreeV1(acceptanceGenerationPin);
  return createProviderNonThenableFrozenRecordV1({
    authority: PROVIDER_STRONG_READY_ACCEPTANCE_CANDIDATE_AUTHORITY_V1,
    activeWriterSelector,
    activeWriterSelectorContentDigest,
    acceptanceStateEnvelope,
    acceptanceGenerationPin,
  }) as ProviderStrongReadyAcceptanceCandidateValidationV1;
}

async function createCandidateInternalV1(
  prepared: PreparedCreateInputV1,
): Promise<ProviderStrongReadyAcceptanceCandidateValidationV1> {
  return buildExpectedCandidateV1(
    prepared.distributionHistoryCandidate,
    prepared.acceptanceOrdinal,
    prepared.predecessor,
    prepared.acceptedAt,
    prepared.identityProof,
  );
}

async function validateCandidateInternalV1(
  prepared: PreparedValidateInputV1,
): Promise<ProviderStrongReadyAcceptanceCandidateValidationV1> {
  const supplied = prepared.acceptanceStateEnvelope;
  if (
    supplied.generationId !== supplied.payload.generationId ||
    supplied.installationIdentityGenerationId !==
      supplied.payload.installationIdentityGenerationId ||
    supplied.acceptedAt !== supplied.payload.acceptedAt
  ) {
    return failV1("acceptance_state", "envelope_mismatch");
  }
  const expected = await buildExpectedCandidateV1(
    prepared.distributionHistoryCandidate,
    supplied.payload.acceptanceOrdinal,
    supplied.payload.predecessor,
    supplied.payload.acceptedAt,
    prepared.identityProof,
  );
  if (
    !canonicalEqualV1(
      supplied.payload.configuration.core.activeWriterSelector,
      expected.activeWriterSelector,
    )
  ) {
    return failV1("active_writer_selector", "selector_mismatch");
  }
  if (
    supplied.generationId !==
      expected.acceptanceStateEnvelope.generationId ||
    supplied.payload.generationId !==
      expected.acceptanceStateEnvelope.payload.generationId
  ) {
    return failV1("acceptance_state", "generation_mismatch");
  }
  if (
    supplied.contentDigest !==
    expected.acceptanceStateEnvelope.contentDigest
  ) {
    return failV1("acceptance_state", "digest_mismatch");
  }
  if (
    !fixedLengthStringEqualV1(
      supplied.payload.acceptanceToken,
      expected.acceptanceStateEnvelope.payload.acceptanceToken,
    )
  ) {
    return failV1("acceptance_state", "token_invalid");
  }
  if (!canonicalEqualV1(supplied, expected.acceptanceStateEnvelope)) {
    return failV1("acceptance_state", "envelope_mismatch");
  }
  return expected;
}

function diagnosticFailureV1(
  stage: ProviderStrongReadyAcceptanceCandidateInvalidStageV1,
  reason: ProviderStrongReadyAcceptanceCandidateInvalidReasonV1,
): StrongReadyAcceptanceCandidateDiagnosticFailureV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function diagnosticFailureFromErrorV1(
  error: unknown,
): StrongReadyAcceptanceCandidateDiagnosticFailureV1 {
  if (isDiagnosticSignalV1(error)) {
    return diagnosticFailureV1(error.stage, error.reason);
  }
  return diagnosticFailureV1("input", "source_invalid");
}

export function createProviderStrongReadyAcceptanceCandidateV1(
  input: CreateProviderStrongReadyAcceptanceCandidateV1Input,
): Promise<ProviderStrongReadyAcceptanceCandidateValidationV1> {
  let prepared: PreparedCreateInputV1;
  try {
    prepared = prepareCreateInputV1(input);
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderStrongReadyAcceptanceCandidateValidationError(),
    );
  }
  let operation: Promise<ProviderStrongReadyAcceptanceCandidateValidationV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      createCandidateInternalV1(prepared),
    );
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderStrongReadyAcceptanceCandidateValidationError(),
    );
  }
  return operation.then(
    (value) => value,
    () => {
      throw new ProviderStrongReadyAcceptanceCandidateValidationError();
    },
  );
}

export function diagnoseCreateProviderStrongReadyAcceptanceCandidateV1(
  input: unknown,
): Promise<ProviderStrongReadyAcceptanceCandidateDiagnosticResultV1> {
  let prepared: PreparedCreateInputV1;
  try {
    prepared = prepareCreateInputV1(input);
  } catch (error) {
    if (isDiagnosticSignalV1(error)) {
      return createProviderPointFulfilledPromiseV1(
        diagnosticFailureV1(error.stage, error.reason),
      );
    }
    return createProviderPointFulfilledPromiseV1(
      diagnosticFailureV1("input", "schema_invalid"),
    );
  }
  let operation: Promise<ProviderStrongReadyAcceptanceCandidateValidationV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      createCandidateInternalV1(prepared),
    );
  } catch (error) {
    return createProviderPointFulfilledPromiseV1(
      diagnosticFailureFromErrorV1(error),
    );
  }
  return operation.then(
    (value) =>
      createProviderNonThenableFrozenRecordV1({ ok: true as const, value }),
    (error) => diagnosticFailureFromErrorV1(error),
  );
}

export function diagnoseProviderStrongReadyAcceptanceCandidateV1(
  input: unknown,
): Promise<ProviderStrongReadyAcceptanceCandidateDiagnosticResultV1> {
  let prepared: PreparedValidateInputV1;
  try {
    prepared = prepareValidateInputV1(input);
  } catch (error) {
    if (isDiagnosticSignalV1(error)) {
      return createProviderPointFulfilledPromiseV1(
        diagnosticFailureV1(error.stage, error.reason),
      );
    }
    return createProviderPointFulfilledPromiseV1(
      diagnosticFailureV1("input", "schema_invalid"),
    );
  }
  let operation: Promise<ProviderStrongReadyAcceptanceCandidateValidationV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      validateCandidateInternalV1(prepared),
    );
  } catch (error) {
    return createProviderPointFulfilledPromiseV1(
      diagnosticFailureFromErrorV1(error),
    );
  }
  return operation.then(
    (value) =>
      createProviderNonThenableFrozenRecordV1({ ok: true as const, value }),
    (error) => diagnosticFailureFromErrorV1(error),
  );
}

export function validateProviderStrongReadyAcceptanceCandidateV1(
  input: ValidateProviderStrongReadyAcceptanceCandidateV1Input,
): Promise<ProviderStrongReadyAcceptanceCandidateValidationV1> {
  let prepared: PreparedValidateInputV1;
  try {
    prepared = prepareValidateInputV1(input);
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderStrongReadyAcceptanceCandidateValidationError(),
    );
  }
  let operation: Promise<ProviderStrongReadyAcceptanceCandidateValidationV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      validateCandidateInternalV1(prepared),
    );
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderStrongReadyAcceptanceCandidateValidationError(),
    );
  }
  return operation.then(
    (value) => value,
    () => {
      throw new ProviderStrongReadyAcceptanceCandidateValidationError();
    },
  );
}

CapturedObjectFreezeV1(deriveProviderActiveWriterSelectorContentDigestV1);
CapturedObjectFreezeV1(
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
);
CapturedObjectFreezeV1(
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
);
CapturedObjectFreezeV1(deriveProviderStrongReadyAcceptanceStateTokenV1);
CapturedObjectFreezeV1(createProviderStrongReadyAcceptanceCandidateV1);
CapturedObjectFreezeV1(
  diagnoseCreateProviderStrongReadyAcceptanceCandidateV1,
);
CapturedObjectFreezeV1(diagnoseProviderStrongReadyAcceptanceCandidateV1);
CapturedObjectFreezeV1(validateProviderStrongReadyAcceptanceCandidateV1);
