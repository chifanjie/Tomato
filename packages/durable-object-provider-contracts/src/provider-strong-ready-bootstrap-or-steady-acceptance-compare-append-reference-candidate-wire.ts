import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  PROVIDER_ACCEPTANCE_STATE_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_STATE_GENERATION_ID_DOMAIN_V1,
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateGenerationIdFieldsV1Schema,
  ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema,
  type ProviderAcceptancePredecessorV1,
  type ProviderStrongReadyAcceptanceStateCandidateV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
  type ProviderStrongReadyAcceptanceStateUnsignedCandidateV1,
} from "./provider-strong-ready-acceptance-candidate.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
} from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = Set.prototype.add;
const CapturedSetPrototypeHasV1 = Set.prototype.has;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTypedArrayPrototypeV1 = CapturedObjectGetPrototypeOfV1(
  CapturedUint8ArrayV1.prototype,
);
const CapturedTypedArrayByteLengthGetterCandidateV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;

if (CapturedTypedArrayByteLengthGetterCandidateV1 === undefined) {
  throw new CapturedTypeErrorV1(
    "Uint8Array byteLength primordial unavailable",
  );
}
const CapturedTypedArrayByteLengthGetterV1 =
  CapturedTypedArrayByteLengthGetterCandidateV1;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const typedArrayByteLengthV1 = bindUncurriedAtBootstrapV1(
  CapturedTypedArrayByteLengthGetterV1,
) as (value: Uint8Array) => number;
const stringSliceV1 = bindUncurriedAtBootstrapV1(
  CapturedStringPrototypeSliceV1,
) as (value: string, start?: number, end?: number) => string;

export const PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_REQUEST_REFERENCE_CANDIDATE_DOMAIN_V1 =
  "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-request-reference-candidate-v1" as const;
export const PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_GENERATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1 =
  "provider-strong-ready-bootstrap-or-steady-acceptance-generation-set-reference-candidate-v1" as const;
export const PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1 =
  "provider-strong-ready-bootstrap-or-steady-acceptance-high-water-reference-candidate-v1" as const;
export const PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_CURRENT_VERSION_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1 =
  "provider-strong-ready-bootstrap-or-steady-acceptance-current-version-token-reference-candidate-v1" as const;
export const PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_REFERENCE_CANDIDATE_DOMAIN_V1 =
  "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-receipt-reference-candidate-v1" as const;
export const PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1 =
  "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-receipt-token-reference-candidate-v1" as const;

const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);
const AcceptanceGenerationCountV1Schema = PositiveSafeIntegerV1Schema.max(
  4_096,
);

function setHasV1<T>(set: ReadonlySet<T>, value: T): boolean {
  return CapturedReflectApplyV1(CapturedSetPrototypeHasV1, set, [
    value,
  ]) as boolean;
}

function setAddV1<T>(set: Set<T>, value: T): void {
  CapturedReflectApplyV1(CapturedSetPrototypeAddV1, set, [value]);
}

function encodeUtf8V1(value: string): Uint8Array {
  return CapturedReflectApplyV1(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [value],
  ) as Uint8Array;
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  const byteLength = typedArrayByteLengthV1(bytes);
  for (let index = 0; index < byteLength; index += 1) {
    const byte = bytes[index]!;
    output +=
      alphabet[(byte >>> 4) & 0x0f]! + alphabet[byte & 0x0f]!;
  }
  return output;
}

function domainPreimageBytesV1(domain: string, fields: object): Uint8Array {
  return encodeUtf8V1(canonicalizeJcsSafeIntegerV1([domain, fields]));
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(domainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

function shortHex22ForDomainV1(domain: string, fields: object): string {
  return stringSliceV1(
    bytesToLowerHexV1(
      sha256InternalV1(domainPreimageBytesV1(domain, fields)),
    ),
    0,
    22,
  );
}

function parseJsonFieldsV1<T>(schema: z.ZodType<T>, input: unknown): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  return schema.parse(input);
}

function freezeParsedJsonV1<T extends object>(value: T): T {
  return deepFreezeProviderPointDetachedDataTreeV1(value);
}

function addIssueV1(
  context: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void {
  context.addIssue({ code: "custom", path, message });
}

interface AcceptanceGenerationPinLikeV1 {
  readonly locatorProfile: "installation_provider_acceptance_state_v1";
  readonly acceptanceOrdinal: number;
  readonly generationId: string;
  readonly contentDigest: string;
}

function generationPinsEqualV1(
  left: AcceptanceGenerationPinLikeV1,
  right: AcceptanceGenerationPinLikeV1,
): boolean {
  return left.locatorProfile === right.locatorProfile &&
    left.acceptanceOrdinal === right.acceptanceOrdinal &&
    left.generationId === right.generationId &&
    left.contentDigest === right.contentDigest;
}

function predecessorsEqualV1(
  left: ProviderAcceptancePredecessorV1,
  right: ProviderAcceptancePredecessorV1,
): boolean {
  if (left.state !== right.state) return false;
  return left.state === "genesis" ||
    (right.state === "acceptance" &&
      left.generationId === right.generationId &&
      left.contentDigest === right.contentDigest);
}

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema =
  z.strictObject({
    locatorProfile: z.literal("installation_provider_acceptance_state_v1"),
    acceptanceOrdinal: AcceptanceGenerationCountV1Schema,
    generationId:
      ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.shape
        .generationId,
    contentDigest: ContentDigestV1Schema,
    commitOperationNonce: LowerHex32V1Schema,
    predecessor:
      ProviderStrongReadyAcceptanceStateCandidateV1Schema.shape.predecessor,
  });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema
>;

function refineGenerationEntriesV1(
  entries: readonly ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1[],
  context: z.RefinementCtx,
  pathPrefix: (string | number)[],
): void {
  const generationIds = new CapturedSetV1<string>();
  const operationNonces = new CapturedSetV1<string>();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const entryPath = [...pathPrefix, index];
    if (entry.acceptanceOrdinal !== index + 1) {
      addIssueV1(
        context,
        [...entryPath, "acceptanceOrdinal"],
        "Acceptance enumeration ordinals must be exactly contiguous 1..N",
      );
    }
    if (setHasV1(generationIds, entry.generationId)) {
      addIssueV1(
        context,
        [...entryPath, "generationId"],
        "Acceptance generation IDs must be unique",
      );
    } else {
      setAddV1(generationIds, entry.generationId);
    }
    if (setHasV1(operationNonces, entry.commitOperationNonce)) {
      addIssueV1(
        context,
        [...entryPath, "commitOperationNonce"],
        "committed Acceptance operation nonces must be unique",
      );
    } else {
      setAddV1(operationNonces, entry.commitOperationNonce);
    }
    if (index === 0) {
      if (entry.predecessor.state !== "genesis") {
        addIssueV1(
          context,
          [...entryPath, "predecessor"],
          "the first Acceptance generation must have the unique genesis predecessor",
        );
      }
      continue;
    }
    const previous = entries[index - 1]!;
    if (
      entry.predecessor.state !== "acceptance" ||
      entry.predecessor.generationId !== previous.generationId ||
      entry.predecessor.contentDigest !== previous.contentDigest
    ) {
      addIssueV1(
        context,
        [...entryPath, "predecessor"],
        "each Acceptance generation must exactly pin the preceding entry",
      );
    }
  }
}

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetFieldsReferenceCandidateV1Schema = z
  .strictObject({
    entries: z
      .array(ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema)
      .min(1)
      .max(4_096),
  })
  .superRefine((fields, context) => {
    refineGenerationEntriesV1(fields.entries, context, ["entries"]);
  });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetFieldsReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetFieldsReferenceCandidateV1Schema
>;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema = z
  .strictObject({
    profile: z.literal("provider_strong_ready_bootstrap_or_steady_acceptance_generation_enumeration_reference_candidate_v1"),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    namespaceRevision: AcceptanceGenerationCountV1Schema,
    entries: z
      .array(ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema)
      .min(1)
      .max(4_096),
    generationCount: AcceptanceGenerationCountV1Schema,
    generationSetDigest: ContentDigestV1Schema,
  })
  .superRefine((enumeration, context) => {
    refineGenerationEntriesV1(enumeration.entries, context, ["entries"]);
    if (enumeration.generationCount !== enumeration.entries.length) {
      addIssueV1(
        context,
        ["generationCount"],
        "generationCount must exactly equal the complete enumeration length",
      );
    }
    if (enumeration.namespaceRevision !== enumeration.generationCount) {
      addIssueV1(
        context,
        ["namespaceRevision"],
        "namespaceRevision must exactly equal the committed generation count",
      );
    }
    if (
      enumeration.generationSetDigest !==
      digestForDomainV1(PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_GENERATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1, {
        entries: enumeration.entries,
      })
    ) {
      addIssueV1(
        context,
        ["generationSetDigest"],
        "generationSetDigest must bind the complete ordered generation set",
      );
    }
  });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema
>;

const ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterGenesisPredecessorCandidateV1Schema =
  z.strictObject({
    state: z.literal("genesis"),
    expectedNamespaceState: z.literal("absent"),
  });
const ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterVersionPredecessorCandidateV1Schema =
  z.strictObject({
    state: z.literal("version"),
    highWaterRevision: AcceptanceGenerationCountV1Schema,
    contentDigest: ContentDigestV1Schema,
    currentVersionToken: KeyedStateTokenV1Schema,
  });
const ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterPredecessorCandidateV1Schema =
  z.discriminatedUnion("state", [
    ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterGenesisPredecessorCandidateV1Schema,
    ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterVersionPredecessorCandidateV1Schema,
  ]);

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema = z
  .strictObject({
    profile: z.literal("provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1"),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    highWaterRevision: AcceptanceGenerationCountV1Schema,
    operationNonce: LowerHex32V1Schema,
    predecessor: ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterPredecessorCandidateV1Schema,
    currentAcceptance:
      ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
    generationCount: AcceptanceGenerationCountV1Schema,
    generationSetDigest: ContentDigestV1Schema,
    acceptedGenerationFloors: z.strictObject({
      rootMetadataGeneration: PositiveSafeIntegerV1Schema,
      registryManifestGeneration: PositiveSafeIntegerV1Schema,
      supportCatalogGeneration: PositiveSafeIntegerV1Schema,
    }),
  })
  .superRefine((highWater, context) => {
    if (
      highWater.highWaterRevision !==
        highWater.currentAcceptance.acceptanceOrdinal ||
      highWater.generationCount !== highWater.highWaterRevision
    ) {
      addIssueV1(
        context,
        ["highWaterRevision"],
        "high-water revision, generation count, and current Acceptance ordinal must be equal",
      );
    }
    if (highWater.highWaterRevision === 1) {
      if (highWater.predecessor.state !== "genesis") {
        addIssueV1(
          context,
          ["predecessor"],
          "the first high-water revision must use the absent genesis predecessor",
        );
      }
    } else if (
      highWater.predecessor.state !== "version" ||
      highWater.predecessor.highWaterRevision !==
        highWater.highWaterRevision - 1
    ) {
      addIssueV1(
        context,
        ["predecessor"],
        "a successor high-water must exactly name the preceding revision",
      );
    }
  });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema
>;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema = z
  .strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal("provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate"),
    locatorProfile: z.literal(
      "installation_provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
    ),
    contentDigest: ContentDigestV1Schema,
    currentVersionToken: KeyedStateTokenV1Schema,
    payload: ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema,
  })
  .superRefine((envelope, context) => {
    if (
      envelope.contentDigest !==
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1(
        envelope.payload,
      )
    ) {
      addIssueV1(
        context,
        ["contentDigest"],
        "high-water Envelope contentDigest must bind its full payload",
      );
    }
  });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema
>;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema = z
  .strictObject({
    profile: z.literal("provider_strong_ready_bootstrap_or_steady_acceptance_current_read_reference_candidate_v1"),
    highWater: ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema,
    enumeration: ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema,
  })
  .superRefine((currentRead, context) => {
    const highWater = currentRead.highWater.payload;
    const enumeration = currentRead.enumeration;
    const lastEntry = enumeration.entries[enumeration.entries.length - 1]!;
    if (
      enumeration.installationIdentityGenerationId !==
      highWater.installationIdentityGenerationId
    ) {
      addIssueV1(
        context,
        ["enumeration", "installationIdentityGenerationId"],
        "current read identity must equal the high-water identity",
      );
    }
    if (
      enumeration.namespaceRevision !== highWater.highWaterRevision ||
      enumeration.generationCount !== highWater.generationCount ||
      enumeration.generationSetDigest !== highWater.generationSetDigest
    ) {
      addIssueV1(
        context,
        ["enumeration"],
        "current read enumeration claims must equal the high-water claims",
      );
    }
    if (!generationPinsEqualV1(lastEntry, highWater.currentAcceptance)) {
      addIssueV1(
        context,
        ["highWater", "payload", "currentAcceptance"],
        "current Acceptance must exactly equal the final enumeration entry",
      );
    }
  });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema
>;

const ProviderStrongReadyBootstrapOrSteadyAcceptanceExpectedGenesisCandidateV1Schema = z.strictObject({
  state: z.literal("genesis"),
  expectedNamespaceState: z.literal("absent"),
});
const ProviderStrongReadyBootstrapOrSteadyAcceptanceExpectedCurrentCandidateV1Schema = z.strictObject({
  state: z.literal("current"),
  highWaterRevision: AcceptanceGenerationCountV1Schema,
  highWaterContentDigest: ContentDigestV1Schema,
  currentVersionToken: KeyedStateTokenV1Schema,
  generationCount: AcceptanceGenerationCountV1Schema,
  generationSetDigest: ContentDigestV1Schema,
});
const ProviderStrongReadyBootstrapOrSteadyAcceptanceExpectedCandidateV1Schema = z.discriminatedUnion(
  "state",
  [
    ProviderStrongReadyBootstrapOrSteadyAcceptanceExpectedGenesisCandidateV1Schema,
    ProviderStrongReadyBootstrapOrSteadyAcceptanceExpectedCurrentCandidateV1Schema,
  ],
);

function projectStrongReadyAcceptanceStateUnsignedInternalV1(
  state: ProviderStrongReadyAcceptanceStateCandidateV1,
): ProviderStrongReadyAcceptanceStateUnsignedCandidateV1 {
  return ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema.parse({
    profile: state.profile,
    generationId: state.generationId,
    installationIdentityGenerationId:
      state.installationIdentityGenerationId,
    acceptanceOrdinal: state.acceptanceOrdinal,
    predecessor: state.predecessor,
    configuration: state.configuration,
    acceptedAt: state.acceptedAt,
  });
}

function deriveStrongReadyAcceptanceStateGenerationIdInternalV1(
  state: ProviderStrongReadyAcceptanceStateCandidateV1,
): string {
  const fields = ProviderStrongReadyAcceptanceStateGenerationIdFieldsV1Schema
    .parse({
      installationIdentityGenerationId:
        state.installationIdentityGenerationId,
      acceptanceOrdinal: state.acceptanceOrdinal,
      predecessor: state.predecessor,
      configuration: state.configuration,
    });
  return `provider-acceptance-state:${shortHex22ForDomainV1(
    PROVIDER_ACCEPTANCE_STATE_GENERATION_ID_DOMAIN_V1,
    fields,
  )}`;
}

function deriveStrongReadyAcceptanceStateContentDigestInternalV1(
  state: ProviderStrongReadyAcceptanceStateCandidateV1,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_ACCEPTANCE_STATE_DOMAIN_V1,
    projectStrongReadyAcceptanceStateUnsignedInternalV1(state),
  );
}

function refineAcceptanceStateEnvelopeV1(
  envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
  context: z.RefinementCtx,
  pathPrefix: (string | number)[],
): void {
  const payload = envelope.payload;
  if (
    envelope.generationId !== payload.generationId ||
    envelope.installationIdentityGenerationId !==
      payload.installationIdentityGenerationId ||
    envelope.acceptedAt !== payload.acceptedAt
  ) {
    addIssueV1(
      context,
      pathPrefix,
      "Acceptance Envelope outer identity and time must equal its payload",
    );
  }
  if (
    payload.generationId !==
    deriveStrongReadyAcceptanceStateGenerationIdInternalV1(payload)
  ) {
    addIssueV1(
      context,
      [...pathPrefix, "payload", "generationId"],
      "Acceptance generation ID must bind the complete generation fields",
    );
  }
  if (
    envelope.contentDigest !==
    deriveStrongReadyAcceptanceStateContentDigestInternalV1(payload)
  ) {
    addIssueV1(
      context,
      [...pathPrefix, "contentDigest"],
      "Acceptance Envelope contentDigest must bind its unsigned payload",
    );
  }
}

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema = z
  .strictObject({
    profile: z.literal("provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_request_reference_candidate_v1"),
    operationNonce: LowerHex32V1Schema,
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    expected: ProviderStrongReadyBootstrapOrSteadyAcceptanceExpectedCandidateV1Schema,
    candidate: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  })
  .superRefine((request, context) => {
    refineAcceptanceStateEnvelopeV1(request.candidate, context, ["candidate"]);
    const candidate = request.candidate.payload;
    if (
      request.installationIdentityGenerationId !==
      candidate.installationIdentityGenerationId
    ) {
      addIssueV1(
        context,
        ["installationIdentityGenerationId"],
        "request and candidate Installation Identity must be equal",
      );
    }
    if (request.expected.state === "genesis") {
      if (
        candidate.acceptanceOrdinal !== 1 ||
        candidate.predecessor.state !== "genesis"
      ) {
        addIssueV1(
          context,
          ["candidate", "payload", "predecessor"],
          "a genesis request must append Acceptance ordinal 1 after genesis",
        );
      }
      return;
    }
    if (
      request.expected.generationCount !==
      request.expected.highWaterRevision
    ) {
      addIssueV1(
        context,
        ["expected", "generationCount"],
        "expected generation count must equal its high-water revision",
      );
    }
    if (
      candidate.acceptanceOrdinal !==
        request.expected.highWaterRevision + 1 ||
      candidate.predecessor.state !== "acceptance"
    ) {
      addIssueV1(
        context,
        ["candidate", "payload", "predecessor"],
        "a successor request must append the next ordinal after an Acceptance predecessor",
      );
    }
  });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema
>;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceObservedHighWaterReferenceCandidateV1Schema =
  z.discriminatedUnion("state", [
    z.strictObject({ state: z.literal("absent") }),
    z.strictObject({
      state: z.literal("trusted"),
      highWater: ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema,
    }),
    z.strictObject({
      state: z.literal("integrity_failed"),
      evidenceDigest: ContentDigestV1Schema,
    }),
  ]);
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceObservedHighWaterReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceObservedHighWaterReferenceCandidateV1Schema
>;

const ProviderStrongReadyBootstrapOrSteadyAcceptanceCommittedOutcomeCandidateV1Schema = z.strictObject({
  outcome: z.literal("committed"),
  committedHighWater: ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema,
  appendedGeneration:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema,
});
const ProviderStrongReadyBootstrapOrSteadyAcceptanceNotCommittedOutcomeCandidateV1Schema = z.strictObject({
  outcome: z.literal("not_committed"),
  reason: z.enum([
    "expected_current_changed",
    "candidate_invalid",
    "generation_floor_regressed",
    "namespace_integrity_failed",
  ]),
  observedHighWater: ProviderStrongReadyBootstrapOrSteadyAcceptanceObservedHighWaterReferenceCandidateV1Schema,
});

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendOutcomeReferenceCandidateV1Schema =
  z
    .discriminatedUnion("outcome", [
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCommittedOutcomeCandidateV1Schema,
      ProviderStrongReadyBootstrapOrSteadyAcceptanceNotCommittedOutcomeCandidateV1Schema,
    ])
    .superRefine((outcome, context) => {
      if (outcome.outcome === "committed") {
        const highWater = outcome.committedHighWater.payload;
        if (
          !generationPinsEqualV1(
            outcome.appendedGeneration,
            highWater.currentAcceptance,
          ) ||
          outcome.appendedGeneration.commitOperationNonce !==
            highWater.operationNonce
        ) {
          addIssueV1(
            context,
            ["appendedGeneration"],
            "committed high-water must select the exact appended generation and commit nonce",
          );
        }
        return;
      }
      const integrityObservation =
        outcome.observedHighWater.state === "integrity_failed";
      if (
        (outcome.reason === "namespace_integrity_failed") !==
        integrityObservation
      ) {
        addIssueV1(
          context,
          ["observedHighWater"],
          "only namespace_integrity_failed may carry an integrity-failed observation",
        );
      }
    });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendOutcomeReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendOutcomeReferenceCandidateV1Schema
>;

const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedShapeCandidateV1 = {
  profile: z.literal("provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1"),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  operationNonce: LowerHex32V1Schema,
  linearizationOrdinal: AcceptanceGenerationCountV1Schema,
  requestContentDigest: ContentDigestV1Schema,
  requestReferenceProjection:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema,
  referenceOutcome:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendOutcomeReferenceCandidateV1Schema,
  resolvedAt: ProviderRegistryIsoTimestampV1Schema,
} as const;

interface AcceptanceReceiptLikeV1 {
  readonly installationIdentityGenerationId: string;
  readonly operationNonce: string;
  readonly linearizationOrdinal: number;
  readonly requestContentDigest: string;
  readonly requestReferenceProjection:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
  readonly referenceOutcome:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendOutcomeReferenceCandidateV1;
}

function refineReceiptBindingsV1(
  receipt: AcceptanceReceiptLikeV1,
  context: z.RefinementCtx,
): void {
  const request = receipt.requestReferenceProjection;
  if (
    receipt.installationIdentityGenerationId !==
      request.installationIdentityGenerationId ||
    receipt.operationNonce !== request.operationNonce
  ) {
    addIssueV1(
      context,
      ["requestReferenceProjection"],
      "receipt identity and nonce must equal the complete request projection",
    );
  }
  if (
    receipt.requestContentDigest !==
    deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
      request,
    )
  ) {
    addIssueV1(
      context,
      ["requestContentDigest"],
      "requestContentDigest must bind the complete strict request",
    );
  }
  const outcome = receipt.referenceOutcome;
  if (outcome.outcome === "committed") {
    const candidate = request.candidate;
    const appended = outcome.appendedGeneration;
    const highWater = outcome.committedHighWater.payload;
    if (
      appended.acceptanceOrdinal !== candidate.payload.acceptanceOrdinal ||
      appended.generationId !== candidate.generationId ||
      appended.contentDigest !== candidate.contentDigest ||
      appended.commitOperationNonce !== receipt.operationNonce ||
      !predecessorsEqualV1(
        appended.predecessor,
        candidate.payload.predecessor,
      )
    ) {
      addIssueV1(
        context,
        ["referenceOutcome", "appendedGeneration"],
        "committed receipt must append the exact request candidate",
      );
    }
    if (
      highWater.installationIdentityGenerationId !==
        receipt.installationIdentityGenerationId ||
      highWater.operationNonce !== receipt.operationNonce ||
      !generationPinsEqualV1(
        highWater.currentAcceptance,
        appended,
      )
    ) {
      addIssueV1(
        context,
        ["referenceOutcome", "committedHighWater"],
        "committed receipt high-water must select the exact request candidate",
      );
    }
    const expected = request.expected;
    const highWaterPredecessor = highWater.predecessor;
    if (expected.state === "genesis") {
      if (highWaterPredecessor.state !== "genesis") {
        addIssueV1(
          context,
          ["referenceOutcome", "committedHighWater", "payload", "predecessor"],
          "a committed genesis request must advance from the absent namespace",
        );
      }
    } else if (
      highWaterPredecessor.state !== "version" ||
      highWaterPredecessor.highWaterRevision !==
        expected.highWaterRevision ||
      highWaterPredecessor.contentDigest !==
        expected.highWaterContentDigest ||
      highWaterPredecessor.currentVersionToken !==
        expected.currentVersionToken ||
      highWater.generationCount !== expected.generationCount + 1
    ) {
      addIssueV1(
        context,
        ["referenceOutcome", "committedHighWater", "payload", "predecessor"],
        "committed high-water must advance the request's exact expected version",
      );
    }
    const candidateCore = candidate.payload.configuration.core;
    const floors = highWater.acceptedGenerationFloors;
    if (
      floors.rootMetadataGeneration <
        candidateCore.activeRootMetadata.rootGeneration ||
      floors.registryManifestGeneration <
        candidateCore.providerRegistryManifest.manifestGeneration ||
      floors.supportCatalogGeneration <
        candidateCore.providerSupportCatalog.catalogGeneration
    ) {
      addIssueV1(
        context,
        ["referenceOutcome", "committedHighWater", "payload", "acceptedGenerationFloors"],
        "accepted generation floors must include the committed candidate generations",
      );
    }
    return;
  }
  if (
    outcome.observedHighWater.state === "trusted" &&
    outcome.observedHighWater.highWater.payload
      .installationIdentityGenerationId !==
      receipt.installationIdentityGenerationId
  ) {
    addIssueV1(
      context,
      ["referenceOutcome", "observedHighWater"],
      "trusted observed high-water must belong to the receipt Installation Identity",
    );
  }
}

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1Schema =
  z
    .strictObject(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedShapeCandidateV1,
    )
    .superRefine(refineReceiptBindingsV1);
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1Schema
>;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema = z
  .strictObject({
    ...ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedShapeCandidateV1,
    receiptToken: KeyedStateTokenV1Schema,
  })
  .superRefine(refineReceiptBindingsV1);
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema
>;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema =
  z
    .strictObject({
      schemaVersion: z.literal(1),
      recordType: z.literal("provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate"),
      locatorProfile: z.literal(
        "installation_provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1",
      ),
      installationIdentityGenerationId:
        InstallationIdentityGenerationIdV1Schema,
      operationNonce: LowerHex32V1Schema,
      resolvedAt: ProviderRegistryIsoTimestampV1Schema,
      contentDigest: ContentDigestV1Schema,
      payload: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema,
    })
    .superRefine((envelope, context) => {
      if (
        envelope.installationIdentityGenerationId !==
          envelope.payload.installationIdentityGenerationId ||
        envelope.operationNonce !== envelope.payload.operationNonce ||
        envelope.resolvedAt !== envelope.payload.resolvedAt
      ) {
        addIssueV1(
          context,
          ["payload"],
          "receipt Envelope outer identity, nonce, and time must equal its payload",
        );
      }
      if (
        envelope.contentDigest !==
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
          envelope.payload,
        )
      ) {
        addIssueV1(
          context,
          ["contentDigest"],
          "receipt Envelope contentDigest must bind its unsigned payload",
        );
      }
    });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema
>;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1Schema =
  z.strictObject({
    locatorProfile: z.literal(
      "installation_provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1",
    ),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    operationNonce: LowerHex32V1Schema,
    contentDigest: ContentDigestV1Schema,
    receiptToken: KeyedStateTokenV1Schema,
  });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1Schema
>;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1Schema =
  z.discriminatedUnion("resolution", [
    z.strictObject({
      resolution: z.literal("resolved"),
      receipt:
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema,
    }),
    z.strictObject({
      resolution: z.literal("request_rejected"),
      reason: z.literal("operation_nonce_request_mismatch"),
      existingReceipt:
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema,
    }),
  ]);
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1Schema
>;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1Schema =
  z.strictObject({
    locatorProfile: z.literal(
      "installation_provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
    ),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    highWaterRevision: AcceptanceGenerationCountV1Schema,
    highWaterContentDigest: ContentDigestV1Schema,
    currentAcceptance:
      ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
    generationCount: AcceptanceGenerationCountV1Schema,
    generationSetDigest: ContentDigestV1Schema,
  });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1 = z.infer<
  typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1Schema
>;

export function projectProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1(
  input: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1 {
  const envelope = parseJsonFieldsV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema,
    input,
  );
  return freezeParsedJsonV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1Schema.parse({
      locatorProfile: envelope.locatorProfile,
      installationIdentityGenerationId:
        envelope.payload.installationIdentityGenerationId,
      highWaterRevision: envelope.payload.highWaterRevision,
      highWaterContentDigest: envelope.contentDigest,
      currentAcceptance: envelope.payload.currentAcceptance,
      generationCount: envelope.payload.generationCount,
      generationSetDigest: envelope.payload.generationSetDigest,
    }),
  );
}

export function projectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1(
  input: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed =
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.safeParse(input);
  if (signed.success) {
    const receipt = signed.data;
    return freezeParsedJsonV1(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1Schema.parse({
        profile: receipt.profile,
        installationIdentityGenerationId:
          receipt.installationIdentityGenerationId,
        operationNonce: receipt.operationNonce,
        linearizationOrdinal: receipt.linearizationOrdinal,
        requestContentDigest: receipt.requestContentDigest,
        requestReferenceProjection: receipt.requestReferenceProjection,
        referenceOutcome: receipt.referenceOutcome,
        resolvedAt: receipt.resolvedAt,
      }),
    );
  }
  return freezeParsedJsonV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1Schema.parse(
      input,
    ),
  );
}

export function deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_REQUEST_REFERENCE_CANDIDATE_DOMAIN_V1,
    parseJsonFieldsV1(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema,
      input,
    ),
  );
}

export function deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_GENERATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
    parseJsonFieldsV1(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetFieldsReferenceCandidateV1Schema,
      input,
    ),
  );
}

export function deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
    parseJsonFieldsV1(ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema, input),
  );
}

export function deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_REFERENCE_CANDIDATE_DOMAIN_V1,
    projectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1(input),
  );
}

export function deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1(
  input: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1 {
  const envelope = parseJsonFieldsV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema,
    input,
  );
  return freezeParsedJsonV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1Schema.parse({
      locatorProfile: envelope.locatorProfile,
      installationIdentityGenerationId:
        envelope.installationIdentityGenerationId,
      operationNonce: envelope.operationNonce,
      contentDigest: envelope.contentDigest,
      receiptToken: envelope.payload.receiptToken,
    }),
  );
}

CapturedObjectFreezeV1(
  projectProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1,
);
CapturedObjectFreezeV1(
  projectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1,
);
CapturedObjectFreezeV1(
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1,
);
CapturedObjectFreezeV1(
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1,
);
CapturedObjectFreezeV1(
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1,
);
CapturedObjectFreezeV1(
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1,
);
CapturedObjectFreezeV1(
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1,
);
