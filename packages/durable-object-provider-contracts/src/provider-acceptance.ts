import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
  ProviderAcceptanceStateGenerationIdV1Schema,
  ProviderMigrationIdV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  ProviderAcceptancePredecessorV1Schema,
  ProviderMigrationStrongReadyCoreV1Schema,
  PROVIDER_ACCEPTANCE_STATE_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_STATE_GENERATION_ID_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
  type ProviderAcceptancePredecessorV1,
} from "./provider-strong-ready-acceptance-candidate.js";
import { ProviderRegistryIsoTimestampV1Schema } from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";

export {
  PROVIDER_ACCEPTANCE_STATE_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_STATE_GENERATION_ID_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
} from "./provider-strong-ready-acceptance-candidate.js";

export const PROVIDER_ACCEPTANCE_COMPARE_APPEND_REQUEST_DOMAIN_V1 =
  "provider-acceptance-compare-append-request-v1" as const;
export const PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_DOMAIN_V1 =
  "provider-acceptance-compare-append-receipt-v1" as const;
export const PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_DOMAIN_V1 =
  "provider-acceptance-compare-append-receipt-token-v1" as const;
export const PROVIDER_ACCEPTANCE_CURRENT_VERSION_TOKEN_DOMAIN_V1 =
  "provider-acceptance-current-version-v1" as const;
export const PROVIDER_ACCEPTANCE_GENERATION_SET_DOMAIN_V1 =
  "provider-acceptance-generation-set-v1" as const;
export const PROVIDER_ACCEPTANCE_HIGH_WATER_DOMAIN_V1 =
  "provider-acceptance-high-water-v1" as const;

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = Set.prototype.add;
const CapturedSetPrototypeHasV1 = Set.prototype.has;

const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);
const AcceptanceHistoryCountV1Schema = PositiveSafeIntegerV1Schema.max(4_096);
const ProviderMigrationHistoryQuotaReservationIdV1Schema = z
  .string()
  .regex(/^provider-migration-history-reservation:[0-9a-f]{22}$/u)
  .brand<"ProviderMigrationHistoryQuotaReservationIdV1">();
const ProviderMigrationProgressRecordIdV1Schema = z
  .string()
  .regex(/^provider-migration-progress:[0-9a-f]{22}$/u)
  .brand<"ProviderMigrationProgressRecordIdV1">();

function parseJsonFieldsV1<T>(schema: z.ZodType<T>, input: unknown): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  return schema.parse(input);
}

function freezeParsedJsonV1<T extends object>(value: T): T {
  return deepFreezeProviderPointDetachedDataTreeV1(value);
}

function bytesToLowerHexV1(bytes: Uint8Array, byteLength: number): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  for (let index = 0; index < byteLength; index += 1) {
    const byte = bytes[index]!;
    output += alphabet[(byte >>> 4) & 0x0f]! + alphabet[byte & 0x0f]!;
  }
  return output;
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
      32,
    )}`,
  );
}

function shortHex22ForDomainV1(domain: string, fields: object): string {
  return bytesToLowerHexV1(
    sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    11,
  );
}

function setHasV1<T>(set: ReadonlySet<T>, value: T): boolean {
  return CapturedReflectApplyV1(CapturedSetPrototypeHasV1, set, [
    value,
  ]) as boolean;
}

function setAddV1<T>(set: Set<T>, value: T): void {
  CapturedReflectApplyV1(CapturedSetPrototypeAddV1, set, [value]);
}

function addIssueV1(
  context: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void {
  context.addIssue({ code: "custom", path, message });
}

function pinsEqualV1(
  left: {
    readonly locatorProfile: string;
    readonly acceptanceOrdinal: number;
    readonly generationId: string;
    readonly contentDigest: string;
  },
  right: {
    readonly locatorProfile: string;
    readonly acceptanceOrdinal: number;
    readonly generationId: string;
    readonly contentDigest: string;
  },
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
  return left.state === right.state &&
    (left.state === "genesis" ||
      (right.state === "acceptance" &&
        left.generationId === right.generationId &&
        left.contentDigest === right.contentDigest));
}

function requiredGenerationFloorsV1(
  configuration: ProviderAcceptedConfigurationV1,
): {
  readonly rootMetadataGeneration: number;
  readonly registryManifestGeneration: number;
  readonly supportCatalogGeneration: number;
} {
  if (configuration.state === "strong_ready") {
    return {
      rootMetadataGeneration:
        configuration.core.activeRootMetadata.rootGeneration,
      registryManifestGeneration:
        configuration.core.providerRegistryManifest.manifestGeneration,
      supportCatalogGeneration:
        configuration.core.providerSupportCatalog.catalogGeneration,
    };
  }
  if (configuration.state === "migration_only") {
    return {
      rootMetadataGeneration:
        configuration.activeRootMetadata.rootGeneration,
      registryManifestGeneration:
        configuration.providerRegistryManifest.manifestGeneration,
      supportCatalogGeneration:
        configuration.providerSupportCatalog.catalogGeneration,
    };
  }
  return {
    rootMetadataGeneration:
      configuration.activeRootMetadata.rootGeneration,
    registryManifestGeneration:
      configuration.lastAcceptedProviderRegistryManifest.manifestGeneration,
    supportCatalogGeneration:
      configuration.lastAcceptedProviderSupportCatalog.catalogGeneration,
  };
}

export const InstallationIdentityStatePinV1Schema = z.strictObject({
  locatorProfile: z.literal("installation_identity_state_v1"),
  generationId: InstallationIdentityGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type InstallationIdentityStatePinV1 = z.infer<
  typeof InstallationIdentityStatePinV1Schema
>;

export const ProviderMigrationPlanPinV1Schema = z.strictObject({
  locatorProfile: z.literal("installation_provider_migration_plan_v1"),
  migrationId: ProviderMigrationIdV1Schema,
  mode: z.enum([
    "same_installation_identity",
    "cross_installation_rebootstrap",
  ]),
  contentDigest: ContentDigestV1Schema,
});
export type ProviderMigrationPlanPinV1 = z.infer<
  typeof ProviderMigrationPlanPinV1Schema
>;

export const ProviderMigrationProgressRecordPinV1Schema = z.strictObject({
  locatorProfile: z.literal(
    "installation_provider_migration_progress_record_v1",
  ),
  migrationId: ProviderMigrationIdV1Schema,
  recordOrdinal: PositiveSafeIntegerV1Schema,
  recordId: ProviderMigrationProgressRecordIdV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderMigrationProgressRecordPinV1 = z.infer<
  typeof ProviderMigrationProgressRecordPinV1Schema
>;

export const ProviderMigrationSealedProgressHeadPinV1Schema = z
  .strictObject({
    locatorProfile: z.literal(
      "installation_provider_migration_progress_head_v1",
    ),
    migrationId: ProviderMigrationIdV1Schema,
    versionOrdinal: PositiveSafeIntegerV1Schema,
    headContentDigest: ContentDigestV1Schema,
    currentVersionToken: KeyedStateTokenV1Schema,
    readyToActivateRecord: ProviderMigrationProgressRecordPinV1Schema,
  })
  .superRefine((pin, context) => {
    if (pin.readyToActivateRecord.migrationId !== pin.migrationId) {
      addIssueV1(
        context,
        ["readyToActivateRecord", "migrationId"],
        "ready-to-activate record must belong to the sealed progress head migration",
      );
    }
  });
export type ProviderMigrationSealedProgressHeadPinV1 = z.infer<
  typeof ProviderMigrationSealedProgressHeadPinV1Schema
>;

const ProviderMigrationHistoryQuotaOperationReceiptPinCommonShapeV1 = {
  locatorProfile: z.literal(
    "installation_provider_migration_history_quota_operation_receipt_v1",
  ),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  operationNonce: LowerHex32V1Schema,
  contentDigest: ContentDigestV1Schema,
  receiptToken: KeyedStateTokenV1Schema,
  migrationId: ProviderMigrationIdV1Schema,
  reservationId: ProviderMigrationHistoryQuotaReservationIdV1Schema,
  migrationPlanContentDigest: ContentDigestV1Schema,
  operation: z.literal("compare_commit"),
  outcome: z.literal("committed"),
} as const;

const ProviderMigrationHistoryQuotaCommittedReceiptSetSameIdentityV1Schema =
  z.strictObject({
    mode: z.literal("same_installation_identity"),
    journalCommit: z.strictObject({
      ...ProviderMigrationHistoryQuotaOperationReceiptPinCommonShapeV1,
      role: z.literal("same_identity_journal"),
      commitKind: z.literal("commit_retained_history"),
    }),
  });

const ProviderMigrationHistoryQuotaCommittedReceiptSetCrossInstallationV1Schema =
  z.strictObject({
    mode: z.literal("cross_installation_rebootstrap"),
    destinationCommit: z.strictObject({
      ...ProviderMigrationHistoryQuotaOperationReceiptPinCommonShapeV1,
      role: z.literal("cross_destination_journal"),
      commitKind: z.literal("commit_retained_history"),
    }),
    sourceCommit: z.strictObject({
      ...ProviderMigrationHistoryQuotaOperationReceiptPinCommonShapeV1,
      role: z.literal("cross_source_anchor"),
      commitKind: z.literal("commit_cross_source_anchor"),
    }),
  }).superRefine((receipts, context) => {
    if (
      receipts.destinationCommit.installationIdentityGenerationId ===
        receipts.sourceCommit.installationIdentityGenerationId
    ) {
      addIssueV1(
        context,
        ["sourceCommit", "installationIdentityGenerationId"],
        "cross-installation quota commits must belong to distinct Installation Identities",
      );
    }
    if (
      receipts.destinationCommit.reservationId ===
        receipts.sourceCommit.reservationId
    ) {
      addIssueV1(
        context,
        ["sourceCommit", "reservationId"],
        "cross-installation quota commits must use distinct role-bound reservations",
      );
    }
    if (
      receipts.destinationCommit.migrationId !==
        receipts.sourceCommit.migrationId
    ) {
      addIssueV1(
        context,
        ["sourceCommit", "migrationId"],
        "cross-installation quota commits must belong to the same migration",
      );
    }
    if (
      receipts.destinationCommit.migrationPlanContentDigest !==
        receipts.sourceCommit.migrationPlanContentDigest
    ) {
      addIssueV1(
        context,
        ["sourceCommit", "migrationPlanContentDigest"],
        "cross-installation quota commits must pin the same migration plan",
      );
    }
  });

export const ProviderMigrationHistoryQuotaCommittedReceiptSetV1Schema =
  z.discriminatedUnion("mode", [
    ProviderMigrationHistoryQuotaCommittedReceiptSetSameIdentityV1Schema,
    ProviderMigrationHistoryQuotaCommittedReceiptSetCrossInstallationV1Schema,
  ]);
export type ProviderMigrationHistoryQuotaCommittedReceiptSetV1 = z.infer<
  typeof ProviderMigrationHistoryQuotaCommittedReceiptSetV1Schema
>;

const ProviderAcceptanceCompletedSameIdentityActivationV1Schema = z
  .strictObject({
    origin: z.literal("completed_provider_migration"),
    migrationPlan: ProviderMigrationPlanPinV1Schema.extend({
      mode: z.literal("same_installation_identity"),
    }),
    sealedProgressHead: ProviderMigrationSealedProgressHeadPinV1Schema,
    migrationHistoryQuotaCommits:
      ProviderMigrationHistoryQuotaCommittedReceiptSetSameIdentityV1Schema,
  })
  .superRefine(refineCompletedMigrationActivationV1);

const ProviderAcceptanceCompletedCrossInstallationActivationV1Schema = z
  .strictObject({
    origin: z.literal("completed_provider_migration"),
    migrationPlan: ProviderMigrationPlanPinV1Schema.extend({
      mode: z.literal("cross_installation_rebootstrap"),
    }),
    sealedProgressHead: ProviderMigrationSealedProgressHeadPinV1Schema,
    migrationHistoryQuotaCommits:
      ProviderMigrationHistoryQuotaCommittedReceiptSetCrossInstallationV1Schema,
  })
  .superRefine(refineCompletedMigrationActivationV1);

function refineCompletedMigrationActivationV1(
  activation: {
    readonly migrationPlan: ProviderMigrationPlanPinV1;
    readonly sealedProgressHead: ProviderMigrationSealedProgressHeadPinV1;
    readonly migrationHistoryQuotaCommits:
      ProviderMigrationHistoryQuotaCommittedReceiptSetV1;
  },
  context: z.RefinementCtx,
): void {
  const plan = activation.migrationPlan;
  if (activation.sealedProgressHead.migrationId !== plan.migrationId) {
    addIssueV1(
      context,
      ["sealedProgressHead", "migrationId"],
      "sealed progress head must belong to the completed migration plan",
    );
  }
  const receipts = activation.migrationHistoryQuotaCommits.mode ===
      "same_installation_identity"
    ? [activation.migrationHistoryQuotaCommits.journalCommit]
    : [
        activation.migrationHistoryQuotaCommits.destinationCommit,
        activation.migrationHistoryQuotaCommits.sourceCommit,
      ];
  for (let index = 0; index < receipts.length; index += 1) {
    const receipt = receipts[index]!;
    if (
      receipt.migrationId !== plan.migrationId ||
      receipt.migrationPlanContentDigest !== plan.contentDigest
    ) {
      addIssueV1(
        context,
        ["migrationHistoryQuotaCommits", index],
        "quota commit must pin the completed migration plan",
      );
    }
  }
}

export const ProviderAcceptanceStrongReadyActivationV1Schema = z.union([
  z.strictObject({ origin: z.literal("bootstrap_or_steady_successor") }),
  ProviderAcceptanceCompletedSameIdentityActivationV1Schema,
  ProviderAcceptanceCompletedCrossInstallationActivationV1Schema,
]);
export type ProviderAcceptanceStrongReadyActivationV1 = z.infer<
  typeof ProviderAcceptanceStrongReadyActivationV1Schema
>;

const ProviderAcceptedStrongReadyConfigurationV1Schema = z.strictObject({
  state: z.literal("strong_ready"),
  core: ProviderMigrationStrongReadyCoreV1Schema,
  activation: ProviderAcceptanceStrongReadyActivationV1Schema,
});

const ProviderAcceptedMigrationOnlyConfigurationV1Schema = z.strictObject({
  state: z.literal("migration_only"),
  reason: z.enum([
    "semantic_policy_change",
    "binding_derivation_secret_compromise",
    "provider_decommission",
    "post_root_compromise_rebind",
    "recovery_key_compromise_rebootstrap",
  ]),
  activeRootMetadata:
    ProviderMigrationStrongReadyCoreV1Schema.shape.activeRootMetadata,
  providerRegistryManifest:
    ProviderMigrationStrongReadyCoreV1Schema.shape.providerRegistryManifest,
  providerSupportCatalog:
    ProviderMigrationStrongReadyCoreV1Schema.shape.providerSupportCatalog,
  publicStrongWriter: z.strictObject({ state: z.literal("disabled") }),
  migrationPlan: ProviderMigrationPlanPinV1Schema,
  migrationExecutor: z.strictObject({
    state: z.literal("enabled_for_plan_only"),
    journalAuthorityInstallationIdentity:
      InstallationIdentityStatePinV1Schema,
    sourceWriter:
      ProviderMigrationStrongReadyCoreV1Schema.shape.activeWriterSelector
        .shape.selections.element,
    destinationWriter:
      ProviderMigrationStrongReadyCoreV1Schema.shape.activeWriterSelector
        .shape.selections.element,
  }),
});

const ProviderAcceptedRecoveryOnlyConfigurationV1Schema = z.strictObject({
  state: z.literal("recovery_only"),
  reason: z.enum([
    "root_compromise_pending_resign_or_migration",
    "recovery_key_compromise_requires_new_installation_identity",
  ]),
  activeRootMetadata:
    ProviderMigrationStrongReadyCoreV1Schema.shape.activeRootMetadata,
  lastAcceptedProviderRegistryManifest:
    ProviderMigrationStrongReadyCoreV1Schema.shape.providerRegistryManifest,
  lastAcceptedProviderSupportCatalog:
    ProviderMigrationStrongReadyCoreV1Schema.shape.providerSupportCatalog,
  publicStrongWriter: z.strictObject({ state: z.literal("disabled") }),
});

export const ProviderAcceptedConfigurationV1Schema = z.discriminatedUnion(
  "state",
  [
    ProviderAcceptedStrongReadyConfigurationV1Schema,
    ProviderAcceptedMigrationOnlyConfigurationV1Schema,
    ProviderAcceptedRecoveryOnlyConfigurationV1Schema,
  ],
).superRefine((configuration, context) => {
  if (configuration.state !== "migration_only") return;
  const requiresCrossInstallation =
    configuration.reason === "recovery_key_compromise_rebootstrap";
  const hasCrossInstallationPlan =
    configuration.migrationPlan.mode === "cross_installation_rebootstrap";
  if (requiresCrossInstallation !== hasCrossInstallationPlan) {
    addIssueV1(
      context,
      ["migrationPlan", "mode"],
      "recovery-key rebootstrap requires a cross-installation plan and every other migration-only reason requires a same-identity plan",
    );
  }
  if (
    configuration.migrationExecutor.sourceWriter.targetProfileId !==
      configuration.migrationExecutor.destinationWriter.targetProfileId
  ) {
    addIssueV1(
      context,
      ["migrationExecutor", "destinationWriter", "targetProfileId"],
      "migration executor source and destination writers must select the same target profile",
    );
  }
  const sourceWriter = configuration.migrationExecutor.sourceWriter;
  const destinationWriter = configuration.migrationExecutor.destinationWriter;
  if (
    configuration.migrationPlan.mode === "same_installation_identity" &&
    sourceWriter.providerId === destinationWriter.providerId &&
    sourceWriter.semanticProviderPolicyDigest ===
      destinationWriter.semanticProviderPolicyDigest &&
    sourceWriter.bindingDerivationKeyGeneration ===
      destinationWriter.bindingDerivationKeyGeneration
  ) {
    addIssueV1(
      context,
      ["migrationExecutor", "destinationWriter"],
      "same-identity migration must change provider, semantic policy, or binding-key generation",
    );
  }
});
export type ProviderAcceptedConfigurationV1 = z.infer<
  typeof ProviderAcceptedConfigurationV1Schema
>;

export const ProviderAcceptanceStateGenerationIdFieldsV1Schema =
  z.strictObject({
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    acceptanceOrdinal: AcceptanceHistoryCountV1Schema,
    predecessor: ProviderAcceptancePredecessorV1Schema,
    configuration: ProviderAcceptedConfigurationV1Schema,
  });
export type ProviderAcceptanceStateGenerationIdFieldsV1 = z.infer<
  typeof ProviderAcceptanceStateGenerationIdFieldsV1Schema
>;

const ProviderAcceptanceStateUnsignedShapeV1 = {
  profile: z.literal("provider_acceptance_state_v1"),
  generationId: ProviderAcceptanceStateGenerationIdV1Schema,
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  acceptanceOrdinal: AcceptanceHistoryCountV1Schema,
  predecessor: ProviderAcceptancePredecessorV1Schema,
  configuration: ProviderAcceptedConfigurationV1Schema,
  acceptedAt: ProviderRegistryIsoTimestampV1Schema,
} as const;

export const ProviderAcceptanceStateUnsignedV1Schema = z
  .strictObject(ProviderAcceptanceStateUnsignedShapeV1)
  .superRefine(refineAcceptanceStateV1);
export type ProviderAcceptanceStateUnsignedV1 = z.infer<
  typeof ProviderAcceptanceStateUnsignedV1Schema
>;

export const ProviderAcceptanceStateV1Schema = z
  .strictObject({
    ...ProviderAcceptanceStateUnsignedShapeV1,
    acceptanceToken: KeyedStateTokenV1Schema,
  })
  .superRefine(refineAcceptanceStateV1);
export type ProviderAcceptanceStateV1 = z.infer<
  typeof ProviderAcceptanceStateV1Schema
>;

function refineAcceptanceStateV1(
  state: {
    readonly generationId: string;
    readonly installationIdentityGenerationId: string;
    readonly acceptanceOrdinal: number;
    readonly predecessor: ProviderAcceptancePredecessorV1;
    readonly configuration: ProviderAcceptedConfigurationV1;
  },
  context: z.RefinementCtx,
): void {
  if (
    (state.acceptanceOrdinal === 1 && state.predecessor.state !== "genesis") ||
    (state.acceptanceOrdinal > 1 && state.predecessor.state !== "acceptance")
  ) {
    addIssueV1(
      context,
      ["predecessor"],
      "Acceptance predecessor kind must match its ordinal",
    );
  }
  const configuration = state.configuration;
  if (
    configuration.state === "migration_only" &&
    configuration.migrationExecutor.journalAuthorityInstallationIdentity
        .generationId !== state.installationIdentityGenerationId
  ) {
    addIssueV1(
      context,
      [
        "configuration",
        "migrationExecutor",
        "journalAuthorityInstallationIdentity",
        "generationId",
      ],
      "migration executor journal authority must equal the Acceptance Installation Identity",
    );
  }
  if (
    configuration.state === "strong_ready" &&
    configuration.activation.origin === "completed_provider_migration"
  ) {
    const quotaCommits =
      configuration.activation.migrationHistoryQuotaCommits;
    if (quotaCommits.mode === "same_installation_identity") {
      if (
        quotaCommits.journalCommit.installationIdentityGenerationId !==
          state.installationIdentityGenerationId
      ) {
        addIssueV1(
          context,
          [
            "configuration",
            "activation",
            "migrationHistoryQuotaCommits",
            "journalCommit",
            "installationIdentityGenerationId",
          ],
          "same-identity quota commit must belong to the Acceptance Installation Identity",
        );
      }
    } else if (
      quotaCommits.destinationCommit.installationIdentityGenerationId !==
        state.installationIdentityGenerationId ||
      quotaCommits.sourceCommit.installationIdentityGenerationId ===
        state.installationIdentityGenerationId
    ) {
      addIssueV1(
        context,
        [
          "configuration",
          "activation",
          "migrationHistoryQuotaCommits",
        ],
        "cross-installation destination quota commit must belong to the Acceptance identity and source commit must belong to the distinct prior identity",
      );
    }
  }
  if (
    state.generationId !==
      deriveProviderAcceptanceStateGenerationIdV1({
        installationIdentityGenerationId:
          state.installationIdentityGenerationId,
        acceptanceOrdinal: state.acceptanceOrdinal,
        predecessor: state.predecessor,
        configuration: state.configuration,
      })
  ) {
    addIssueV1(
      context,
      ["generationId"],
      "Acceptance generation ID must bind the complete generation fields",
    );
  }
}

export const ProviderAcceptanceStateEnvelopeV1Schema = z
  .strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal("provider_acceptance_state"),
    generationId: ProviderAcceptanceStateGenerationIdV1Schema,
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    acceptedAt: ProviderRegistryIsoTimestampV1Schema,
    contentDigest: ContentDigestV1Schema,
    payload: ProviderAcceptanceStateV1Schema,
  })
  .superRefine((envelope, context) => {
    if (
      envelope.generationId !== envelope.payload.generationId ||
      envelope.installationIdentityGenerationId !==
        envelope.payload.installationIdentityGenerationId ||
      envelope.acceptedAt !== envelope.payload.acceptedAt
    ) {
      addIssueV1(
        context,
        ["payload"],
        "Acceptance Envelope identity and time must equal its payload",
      );
    }
    if (
      envelope.contentDigest !==
        deriveProviderAcceptanceStateContentDigestV1(envelope.payload)
    ) {
      addIssueV1(
        context,
        ["contentDigest"],
        "Acceptance Envelope content digest must bind its unsigned payload",
      );
    }
  });
export type ProviderAcceptanceStateEnvelopeV1 = z.infer<
  typeof ProviderAcceptanceStateEnvelopeV1Schema
>;

export const ProviderAcceptanceGenerationPinV1Schema = z.strictObject({
  locatorProfile: z.literal("installation_provider_acceptance_state_v1"),
  acceptanceOrdinal: AcceptanceHistoryCountV1Schema,
  generationId: ProviderAcceptanceStateGenerationIdV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderAcceptanceGenerationPinV1 = z.infer<
  typeof ProviderAcceptanceGenerationPinV1Schema
>;

export const ProviderAcceptanceGenerationEnumerationEntryV1Schema =
  z.strictObject({
    locatorProfile: z.literal("installation_provider_acceptance_state_v1"),
    acceptanceOrdinal: AcceptanceHistoryCountV1Schema,
    generationId: ProviderAcceptanceStateGenerationIdV1Schema,
    contentDigest: ContentDigestV1Schema,
    commitOperationNonce: LowerHex32V1Schema,
    predecessor: ProviderAcceptancePredecessorV1Schema,
  });
export type ProviderAcceptanceGenerationEnumerationEntryV1 = z.infer<
  typeof ProviderAcceptanceGenerationEnumerationEntryV1Schema
>;

function refineGenerationEntriesV1(
  entries: readonly ProviderAcceptanceGenerationEnumerationEntryV1[],
  context: z.RefinementCtx,
  pathPrefix: (string | number)[],
): void {
  const generationIds = new CapturedSetV1<string>();
  const operationNonces = new CapturedSetV1<string>();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const path = [...pathPrefix, index];
    if (entry.acceptanceOrdinal !== index + 1) {
      addIssueV1(
        context,
        [...path, "acceptanceOrdinal"],
        "Acceptance ordinals must be exactly contiguous 1..N",
      );
    }
    if (setHasV1(generationIds, entry.generationId)) {
      addIssueV1(
        context,
        [...path, "generationId"],
        "Acceptance generation IDs must be unique",
      );
    }
    setAddV1(generationIds, entry.generationId);
    if (setHasV1(operationNonces, entry.commitOperationNonce)) {
      addIssueV1(
        context,
        [...path, "commitOperationNonce"],
        "committed Acceptance operation nonces must be unique",
      );
    }
    setAddV1(operationNonces, entry.commitOperationNonce);
    if (index === 0) {
      if (entry.predecessor.state !== "genesis") {
        addIssueV1(
          context,
          [...path, "predecessor"],
          "the first Acceptance generation must use the genesis predecessor",
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
        [...path, "predecessor"],
        "each Acceptance generation must exactly pin the preceding entry",
      );
    }
  }
}

export const ProviderAcceptanceGenerationSetFieldsV1Schema = z
  .strictObject({
    entries: z
      .array(ProviderAcceptanceGenerationEnumerationEntryV1Schema)
      .min(1)
      .max(4_096),
  })
  .superRefine((fields, context) => {
    refineGenerationEntriesV1(fields.entries, context, ["entries"]);
  });
export type ProviderAcceptanceGenerationSetFieldsV1 = z.infer<
  typeof ProviderAcceptanceGenerationSetFieldsV1Schema
>;

export const ProviderAcceptanceGenerationEnumerationV1Schema = z
  .strictObject({
    profile: z.literal("provider_acceptance_generation_enumeration_v1"),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    namespaceRevision: AcceptanceHistoryCountV1Schema,
    entries: z
      .array(ProviderAcceptanceGenerationEnumerationEntryV1Schema)
      .min(1)
      .max(4_096),
    generationCount: AcceptanceHistoryCountV1Schema,
    generationSetDigest: ContentDigestV1Schema,
  })
  .superRefine((enumeration, context) => {
    refineGenerationEntriesV1(enumeration.entries, context, ["entries"]);
    if (
      enumeration.namespaceRevision !== enumeration.entries.length ||
      enumeration.generationCount !== enumeration.entries.length
    ) {
      addIssueV1(
        context,
        ["generationCount"],
        "namespace revision and generation count must equal the complete enumeration length",
      );
    }
    if (
      enumeration.generationSetDigest !==
        deriveProviderAcceptanceGenerationSetDigestV1({
          entries: enumeration.entries,
        })
    ) {
      addIssueV1(
        context,
        ["generationSetDigest"],
        "generation-set digest must bind the complete ordered enumeration",
      );
    }
  });
export type ProviderAcceptanceGenerationEnumerationV1 = z.infer<
  typeof ProviderAcceptanceGenerationEnumerationV1Schema
>;

const ProviderAcceptanceHighWaterPredecessorV1Schema = z.discriminatedUnion(
  "state",
  [
    z.strictObject({
      state: z.literal("genesis"),
      expectedNamespaceState: z.literal("absent"),
    }),
    z.strictObject({
      state: z.literal("version"),
      highWaterRevision: AcceptanceHistoryCountV1Schema,
      contentDigest: ContentDigestV1Schema,
      currentVersionToken: KeyedStateTokenV1Schema,
    }),
  ],
);

export const ProviderAcceptanceHighWaterV1Schema = z
  .strictObject({
    profile: z.literal("provider_acceptance_high_water_v1"),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    highWaterRevision: AcceptanceHistoryCountV1Schema,
    operationNonce: LowerHex32V1Schema,
    predecessor: ProviderAcceptanceHighWaterPredecessorV1Schema,
    currentAcceptance: ProviderAcceptanceGenerationPinV1Schema,
    generationCount: AcceptanceHistoryCountV1Schema,
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
        "high-water revision, generation count, and current ordinal must be equal",
      );
    }
    if (highWater.highWaterRevision === 1) {
      if (highWater.predecessor.state !== "genesis") {
        addIssueV1(
          context,
          ["predecessor"],
          "the first high-water must use the absent genesis predecessor",
        );
      }
    } else if (
      highWater.predecessor.state !== "version" ||
      highWater.predecessor.highWaterRevision !== highWater.highWaterRevision - 1
    ) {
      addIssueV1(
        context,
        ["predecessor"],
        "a successor high-water must exactly name the preceding revision",
      );
    }
  });
export type ProviderAcceptanceHighWaterV1 = z.infer<
  typeof ProviderAcceptanceHighWaterV1Schema
>;

export const ProviderAcceptanceHighWaterEnvelopeV1Schema = z
  .strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal("provider_acceptance_high_water"),
    locatorProfile: z.literal(
      "installation_provider_acceptance_high_water_v1",
    ),
    contentDigest: ContentDigestV1Schema,
    currentVersionToken: KeyedStateTokenV1Schema,
    payload: ProviderAcceptanceHighWaterV1Schema,
  })
  .superRefine((envelope, context) => {
    if (
      envelope.contentDigest !==
        deriveProviderAcceptanceHighWaterContentDigestV1(envelope.payload)
    ) {
      addIssueV1(
        context,
        ["contentDigest"],
        "high-water Envelope content digest must bind its complete payload",
      );
    }
  });
export type ProviderAcceptanceHighWaterEnvelopeV1 = z.infer<
  typeof ProviderAcceptanceHighWaterEnvelopeV1Schema
>;

export const ProviderAcceptanceCurrentReadV1Schema = z
  .strictObject({
    profile: z.literal("provider_acceptance_current_read_v1"),
    highWater: ProviderAcceptanceHighWaterEnvelopeV1Schema,
    enumeration: ProviderAcceptanceGenerationEnumerationV1Schema,
  })
  .superRefine((current, context) => {
    const highWater = current.highWater.payload;
    const enumeration = current.enumeration;
    const last = enumeration.entries[enumeration.entries.length - 1]!;
    if (
      enumeration.installationIdentityGenerationId !==
        highWater.installationIdentityGenerationId ||
      enumeration.namespaceRevision !== highWater.highWaterRevision ||
      enumeration.generationCount !== highWater.generationCount ||
      enumeration.generationSetDigest !== highWater.generationSetDigest
    ) {
      addIssueV1(
        context,
        ["enumeration"],
        "current enumeration must equal the high-water complete-set claims",
      );
    }
    if (!pinsEqualV1(last, highWater.currentAcceptance)) {
      addIssueV1(
        context,
        ["highWater", "payload", "currentAcceptance"],
        "current Acceptance must equal the final enumeration entry",
      );
    }
    if (last.commitOperationNonce !== highWater.operationNonce) {
      addIssueV1(
        context,
        ["highWater", "payload", "operationNonce"],
        "current high-water operation nonce must equal its final enumeration entry commit nonce",
      );
    }
  });
export type ProviderAcceptanceCurrentReadV1 = z.infer<
  typeof ProviderAcceptanceCurrentReadV1Schema
>;

export const ProviderAcceptanceCurrentPinV1Schema = z
  .strictObject({
    highWaterLocatorProfile: z.literal(
      "installation_provider_acceptance_high_water_v1",
    ),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    acceptance: ProviderAcceptanceGenerationPinV1Schema,
    highWaterRevision: AcceptanceHistoryCountV1Schema,
    highWaterContentDigest: ContentDigestV1Schema,
    currentVersionToken: KeyedStateTokenV1Schema,
    generationCount: AcceptanceHistoryCountV1Schema,
    generationSetDigest: ContentDigestV1Schema,
    acceptedGenerationFloors: z.strictObject({
      rootMetadataGeneration: PositiveSafeIntegerV1Schema,
      registryManifestGeneration: PositiveSafeIntegerV1Schema,
      supportCatalogGeneration: PositiveSafeIntegerV1Schema,
    }),
  })
  .superRefine((pin, context) => {
    if (
      pin.highWaterRevision !== pin.generationCount ||
      pin.highWaterRevision !== pin.acceptance.acceptanceOrdinal
    ) {
      addIssueV1(
        context,
        ["highWaterRevision"],
        "current pin revision, generation count, and Acceptance ordinal must be equal",
      );
    }
  });
export type ProviderAcceptanceCurrentPinV1 = z.infer<
  typeof ProviderAcceptanceCurrentPinV1Schema
>;

const ProviderAcceptanceExpectedV1Schema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("genesis"),
    expectedNamespaceState: z.literal("absent"),
  }),
  z.strictObject({
    state: z.literal("current"),
    highWaterRevision: AcceptanceHistoryCountV1Schema,
    highWaterContentDigest: ContentDigestV1Schema,
    currentVersionToken: KeyedStateTokenV1Schema,
    generationCount: AcceptanceHistoryCountV1Schema,
    generationSetDigest: ContentDigestV1Schema,
  }),
]);

export const ProviderAcceptanceCompareAppendRequestV1Schema = z
  .strictObject({
    profile: z.literal("provider_acceptance_compare_append_request_v1"),
    operationNonce: LowerHex32V1Schema,
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    expected: ProviderAcceptanceExpectedV1Schema,
    candidate: ProviderAcceptanceStateEnvelopeV1Schema,
  })
  .superRefine((request, context) => {
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
          "a genesis request must append ordinal 1 after genesis",
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
        "a successor request must append the next Acceptance ordinal",
      );
    }
  });
export type ProviderAcceptanceCompareAppendRequestV1 = z.infer<
  typeof ProviderAcceptanceCompareAppendRequestV1Schema
>;

export const ProviderAcceptanceObservedHighWaterV1Schema =
  z.discriminatedUnion("state", [
    z.strictObject({ state: z.literal("absent") }),
    z.strictObject({
      state: z.literal("trusted"),
      highWater: ProviderAcceptanceHighWaterEnvelopeV1Schema,
    }),
    z.strictObject({
      state: z.literal("integrity_failed"),
      evidenceDigest: ContentDigestV1Schema,
    }),
  ]);
export type ProviderAcceptanceObservedHighWaterV1 = z.infer<
  typeof ProviderAcceptanceObservedHighWaterV1Schema
>;

export const ProviderAcceptanceCompareAppendDurableOutcomeV1Schema = z
  .discriminatedUnion("outcome", [
    z.strictObject({
      outcome: z.literal("committed"),
      committedHighWater: ProviderAcceptanceHighWaterEnvelopeV1Schema,
      appendedGeneration:
        ProviderAcceptanceGenerationEnumerationEntryV1Schema,
    }),
    z.strictObject({
      outcome: z.literal("not_committed"),
      reason: z.enum([
        "expected_current_changed",
        "candidate_invalid",
        "generation_floor_regressed",
        "namespace_integrity_failed",
      ]),
      observedHighWater: ProviderAcceptanceObservedHighWaterV1Schema,
    }),
  ])
  .superRefine((outcome, context) => {
    if (outcome.outcome === "committed") {
      if (
        !pinsEqualV1(
          outcome.appendedGeneration,
          outcome.committedHighWater.payload.currentAcceptance,
        ) ||
        outcome.appendedGeneration.commitOperationNonce !==
          outcome.committedHighWater.payload.operationNonce
      ) {
        addIssueV1(
          context,
          ["appendedGeneration"],
          "committed high-water must select the exact appended generation",
        );
      }
      return;
    }
    if (
      (outcome.reason === "namespace_integrity_failed") !==
      (outcome.observedHighWater.state === "integrity_failed")
    ) {
      addIssueV1(
        context,
        ["observedHighWater"],
        "only namespace_integrity_failed may carry an integrity-failed observation",
      );
    }
  });
export type ProviderAcceptanceCompareAppendDurableOutcomeV1 = z.infer<
  typeof ProviderAcceptanceCompareAppendDurableOutcomeV1Schema
>;

const ProviderAcceptanceCompareAppendReceiptUnsignedShapeV1 = {
  profile: z.literal("provider_acceptance_compare_append_receipt_v1"),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  operationNonce: LowerHex32V1Schema,
  requestContentDigest: ContentDigestV1Schema,
  requestDurableProjection:
    ProviderAcceptanceCompareAppendRequestV1Schema,
  durableOutcome: ProviderAcceptanceCompareAppendDurableOutcomeV1Schema,
  resolvedAt: ProviderRegistryIsoTimestampV1Schema,
} as const;

type AcceptanceReceiptLikeV1 = z.infer<
  typeof ProviderAcceptanceCompareAppendReceiptUnsignedBaseV1Schema
> & { readonly receiptToken?: string };

function refineAcceptanceReceiptV1(
  receipt: AcceptanceReceiptLikeV1,
  context: z.RefinementCtx,
): void {
  const request = receipt.requestDurableProjection;
  if (
    receipt.installationIdentityGenerationId !==
      request.installationIdentityGenerationId ||
    receipt.operationNonce !== request.operationNonce
  ) {
    addIssueV1(
      context,
      ["requestDurableProjection"],
      "receipt identity and nonce must equal its complete request",
    );
  }
  if (
    receipt.requestContentDigest !==
      deriveProviderAcceptanceCompareAppendRequestContentDigestV1(request)
  ) {
    addIssueV1(
      context,
      ["requestContentDigest"],
      "request content digest must bind the complete strict request",
    );
  }
  const outcome = receipt.durableOutcome;
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
        ["durableOutcome", "appendedGeneration"],
        "committed receipt must append the exact request candidate",
      );
    }
    if (
      highWater.installationIdentityGenerationId !==
        receipt.installationIdentityGenerationId ||
      highWater.operationNonce !== receipt.operationNonce ||
      !pinsEqualV1(highWater.currentAcceptance, appended)
    ) {
      addIssueV1(
        context,
        ["durableOutcome", "committedHighWater"],
        "committed receipt high-water must select the exact request candidate",
      );
    }
    const requiredFloors = requiredGenerationFloorsV1(
      candidate.payload.configuration,
    );
    if (
      highWater.acceptedGenerationFloors.rootMetadataGeneration <
        requiredFloors.rootMetadataGeneration ||
      highWater.acceptedGenerationFloors.registryManifestGeneration <
        requiredFloors.registryManifestGeneration ||
      highWater.acceptedGenerationFloors.supportCatalogGeneration <
        requiredFloors.supportCatalogGeneration
    ) {
      addIssueV1(
        context,
        [
          "durableOutcome",
          "committedHighWater",
          "payload",
          "acceptedGenerationFloors",
        ],
        "committed high-water floors must cover every generation referenced by the accepted configuration",
      );
    }
    const expected = request.expected;
    if (expected.state === "genesis") {
      if (
        highWater.generationSetDigest !==
          deriveProviderAcceptanceGenerationSetDigestV1({
            entries: [appended],
          })
      ) {
        addIssueV1(
          context,
          [
            "durableOutcome",
            "committedHighWater",
            "payload",
            "generationSetDigest",
          ],
          "committed genesis high-water must bind exactly its one appended generation",
        );
      }
      if (
        highWater.acceptedGenerationFloors.rootMetadataGeneration !==
          requiredFloors.rootMetadataGeneration ||
        highWater.acceptedGenerationFloors.registryManifestGeneration !==
          requiredFloors.registryManifestGeneration ||
        highWater.acceptedGenerationFloors.supportCatalogGeneration !==
          requiredFloors.supportCatalogGeneration
      ) {
        addIssueV1(
          context,
          [
            "durableOutcome",
            "committedHighWater",
            "payload",
            "acceptedGenerationFloors",
          ],
          "committed genesis floors must exactly equal the first accepted configuration generations",
        );
      }
      if (highWater.predecessor.state !== "genesis") {
        addIssueV1(
          context,
          ["durableOutcome", "committedHighWater", "payload", "predecessor"],
          "committed genesis request must advance from the absent namespace",
        );
      }
    } else if (
      highWater.predecessor.state !== "version" ||
      highWater.predecessor.highWaterRevision !== expected.highWaterRevision ||
      highWater.predecessor.contentDigest !==
        expected.highWaterContentDigest ||
      highWater.predecessor.currentVersionToken !==
        expected.currentVersionToken ||
      highWater.generationCount !== expected.generationCount + 1
    ) {
      addIssueV1(
        context,
        ["durableOutcome", "committedHighWater", "payload", "predecessor"],
        "committed high-water must advance the exact expected version",
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
      ["durableOutcome", "observedHighWater"],
      "trusted observed high-water must belong to the receipt Installation Identity",
    );
  }
}

const ProviderAcceptanceCompareAppendReceiptUnsignedBaseV1Schema =
  z.strictObject(ProviderAcceptanceCompareAppendReceiptUnsignedShapeV1);

export const ProviderAcceptanceCompareAppendReceiptUnsignedV1Schema =
  ProviderAcceptanceCompareAppendReceiptUnsignedBaseV1Schema.superRefine(
    refineAcceptanceReceiptV1,
  );
export type ProviderAcceptanceCompareAppendReceiptUnsignedV1 = z.infer<
  typeof ProviderAcceptanceCompareAppendReceiptUnsignedV1Schema
>;

export const ProviderAcceptanceCompareAppendReceiptV1Schema = z
  .strictObject({
    ...ProviderAcceptanceCompareAppendReceiptUnsignedShapeV1,
    receiptToken: KeyedStateTokenV1Schema,
  })
  .superRefine(refineAcceptanceReceiptV1);
export type ProviderAcceptanceCompareAppendReceiptV1 = z.infer<
  typeof ProviderAcceptanceCompareAppendReceiptV1Schema
>;

export const ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema = z
  .strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal(
      "provider_acceptance_compare_append_receipt",
    ),
    locatorProfile: z.literal(
      "installation_provider_acceptance_compare_append_receipt_v1",
    ),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    operationNonce: LowerHex32V1Schema,
    resolvedAt: ProviderRegistryIsoTimestampV1Schema,
    contentDigest: ContentDigestV1Schema,
    payload: ProviderAcceptanceCompareAppendReceiptV1Schema,
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
        "receipt Envelope identity, nonce, and time must equal its payload",
      );
    }
    if (
      envelope.contentDigest !==
        deriveProviderAcceptanceCompareAppendReceiptContentDigestV1(
          envelope.payload,
        )
    ) {
      addIssueV1(
        context,
        ["contentDigest"],
        "receipt Envelope content digest must bind its unsigned payload",
      );
    }
  });
export type ProviderAcceptanceCompareAppendReceiptEnvelopeV1 = z.infer<
  typeof ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema
>;

export const ProviderAcceptanceCompareAppendReceiptPinV1Schema =
  z.strictObject({
    locatorProfile: z.literal(
      "installation_provider_acceptance_compare_append_receipt_v1",
    ),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema,
    operationNonce: LowerHex32V1Schema,
    contentDigest: ContentDigestV1Schema,
    receiptToken: KeyedStateTokenV1Schema,
  });
export type ProviderAcceptanceCompareAppendReceiptPinV1 = z.infer<
  typeof ProviderAcceptanceCompareAppendReceiptPinV1Schema
>;

export const ProviderAcceptanceCompareAppendResultV1Schema =
  z.discriminatedUnion("resolution", [
    z.strictObject({
      resolution: z.literal("resolved"),
      receipt: ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema,
    }),
    z.strictObject({
      resolution: z.literal("request_rejected"),
      reason: z.literal("operation_nonce_request_mismatch"),
      existingReceipt:
        ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema,
    }),
  ]);
export type ProviderAcceptanceCompareAppendResultV1 = z.infer<
  typeof ProviderAcceptanceCompareAppendResultV1Schema
>;

export const ProviderAcceptanceCurrentVersionTokenFieldsV1Schema =
  z
    .strictObject({
      locatorProfile: z.literal(
        "installation_provider_acceptance_high_water_v1",
      ),
      installationIdentityGenerationId:
        InstallationIdentityGenerationIdV1Schema,
      highWaterRevision: AcceptanceHistoryCountV1Schema,
      highWaterContentDigest: ContentDigestV1Schema,
      currentAcceptance: ProviderAcceptanceGenerationPinV1Schema,
      generationCount: AcceptanceHistoryCountV1Schema,
      generationSetDigest: ContentDigestV1Schema,
    })
    .superRefine((fields, context) => {
      if (
        fields.highWaterRevision !== fields.generationCount ||
        fields.highWaterRevision !==
          fields.currentAcceptance.acceptanceOrdinal
      ) {
        addIssueV1(
          context,
          ["highWaterRevision"],
          "current-version token revision, generation count, and Acceptance ordinal must be equal",
        );
      }
    });
export type ProviderAcceptanceCurrentVersionTokenFieldsV1 = z.infer<
  typeof ProviderAcceptanceCurrentVersionTokenFieldsV1Schema
>;

export function projectProviderAcceptanceStateUnsignedV1(
  input: unknown,
): ProviderAcceptanceStateUnsignedV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed = ProviderAcceptanceStateV1Schema.safeParse(input);
  if (signed.success) {
    const { acceptanceToken: _acceptanceToken, ...unsigned } = signed.data;
    return freezeParsedJsonV1(
      ProviderAcceptanceStateUnsignedV1Schema.parse(unsigned),
    );
  }
  return freezeParsedJsonV1(
    ProviderAcceptanceStateUnsignedV1Schema.parse(input),
  );
}

export function deriveProviderAcceptanceStateGenerationIdV1(
  input: unknown,
): z.infer<typeof ProviderAcceptanceStateGenerationIdV1Schema> {
  const fields = parseJsonFieldsV1(
    ProviderAcceptanceStateGenerationIdFieldsV1Schema,
    input,
  );
  return ProviderAcceptanceStateGenerationIdV1Schema.parse(
    `provider-acceptance-state:${shortHex22ForDomainV1(
      PROVIDER_ACCEPTANCE_STATE_GENERATION_ID_DOMAIN_V1,
      fields,
    )}`,
  );
}

export function deriveProviderAcceptanceStateContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_ACCEPTANCE_STATE_DOMAIN_V1,
    projectProviderAcceptanceStateUnsignedV1(input),
  );
}

export function createProviderAcceptanceStateTokenMessageV1(
  input: unknown,
): Uint8Array {
  return createDomainPreimageBytesV1(
    PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
    projectProviderAcceptanceStateUnsignedV1(input),
  );
}

export function deriveProviderAcceptanceGenerationSetDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_ACCEPTANCE_GENERATION_SET_DOMAIN_V1,
    parseJsonFieldsV1(ProviderAcceptanceGenerationSetFieldsV1Schema, input),
  );
}

export function deriveProviderAcceptanceHighWaterContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_ACCEPTANCE_HIGH_WATER_DOMAIN_V1,
    parseJsonFieldsV1(ProviderAcceptanceHighWaterV1Schema, input),
  );
}

export function deriveProviderAcceptanceCompareAppendRequestContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_ACCEPTANCE_COMPARE_APPEND_REQUEST_DOMAIN_V1,
    parseJsonFieldsV1(ProviderAcceptanceCompareAppendRequestV1Schema, input),
  );
}

export function projectProviderAcceptanceCompareAppendReceiptUnsignedV1(
  input: unknown,
): ProviderAcceptanceCompareAppendReceiptUnsignedV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed = ProviderAcceptanceCompareAppendReceiptV1Schema.safeParse(input);
  if (signed.success) {
    const { receiptToken: _receiptToken, ...unsigned } = signed.data;
    return freezeParsedJsonV1(
      ProviderAcceptanceCompareAppendReceiptUnsignedV1Schema.parse(unsigned),
    );
  }
  return freezeParsedJsonV1(
    ProviderAcceptanceCompareAppendReceiptUnsignedV1Schema.parse(input),
  );
}

export function deriveProviderAcceptanceCompareAppendReceiptContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_DOMAIN_V1,
    projectProviderAcceptanceCompareAppendReceiptUnsignedV1(input),
  );
}

export function projectProviderAcceptanceCurrentVersionTokenFieldsV1(
  input: unknown,
): ProviderAcceptanceCurrentVersionTokenFieldsV1 {
  const envelope = parseJsonFieldsV1(
    ProviderAcceptanceHighWaterEnvelopeV1Schema,
    input,
  );
  return freezeParsedJsonV1(
    ProviderAcceptanceCurrentVersionTokenFieldsV1Schema.parse({
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

export function createProviderAcceptanceCurrentVersionTokenMessageV1(
  input: unknown,
): Uint8Array {
  return createDomainPreimageBytesV1(
    PROVIDER_ACCEPTANCE_CURRENT_VERSION_TOKEN_DOMAIN_V1,
    projectProviderAcceptanceCurrentVersionTokenFieldsV1(input),
  );
}

export function createProviderAcceptanceCompareAppendReceiptTokenMessageV1(
  input: unknown,
): Uint8Array {
  return createDomainPreimageBytesV1(
    PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_DOMAIN_V1,
    projectProviderAcceptanceCompareAppendReceiptUnsignedV1(input),
  );
}

export function deriveProviderAcceptanceCurrentPinV1(
  input: unknown,
): ProviderAcceptanceCurrentPinV1 {
  const envelope = parseJsonFieldsV1(
    ProviderAcceptanceHighWaterEnvelopeV1Schema,
    input,
  );
  return freezeParsedJsonV1(
    ProviderAcceptanceCurrentPinV1Schema.parse({
      highWaterLocatorProfile: envelope.locatorProfile,
      installationIdentityGenerationId:
        envelope.payload.installationIdentityGenerationId,
      acceptance: envelope.payload.currentAcceptance,
      highWaterRevision: envelope.payload.highWaterRevision,
      highWaterContentDigest: envelope.contentDigest,
      currentVersionToken: envelope.currentVersionToken,
      generationCount: envelope.payload.generationCount,
      generationSetDigest: envelope.payload.generationSetDigest,
      acceptedGenerationFloors: envelope.payload.acceptedGenerationFloors,
    }),
  );
}

export function deriveProviderAcceptanceCompareAppendReceiptPinV1(
  input: unknown,
): ProviderAcceptanceCompareAppendReceiptPinV1 {
  const envelope = parseJsonFieldsV1(
    ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema,
    input,
  );
  return freezeParsedJsonV1(
    ProviderAcceptanceCompareAppendReceiptPinV1Schema.parse({
      locatorProfile: envelope.locatorProfile,
      installationIdentityGenerationId:
        envelope.installationIdentityGenerationId,
      operationNonce: envelope.operationNonce,
      contentDigest: envelope.contentDigest,
      receiptToken: envelope.payload.receiptToken,
    }),
  );
}

CapturedObjectFreezeV1(projectProviderAcceptanceStateUnsignedV1);
CapturedObjectFreezeV1(deriveProviderAcceptanceStateGenerationIdV1);
CapturedObjectFreezeV1(deriveProviderAcceptanceStateContentDigestV1);
CapturedObjectFreezeV1(createProviderAcceptanceStateTokenMessageV1);
CapturedObjectFreezeV1(deriveProviderAcceptanceGenerationSetDigestV1);
CapturedObjectFreezeV1(deriveProviderAcceptanceHighWaterContentDigestV1);
CapturedObjectFreezeV1(
  deriveProviderAcceptanceCompareAppendRequestContentDigestV1,
);
CapturedObjectFreezeV1(
  projectProviderAcceptanceCompareAppendReceiptUnsignedV1,
);
CapturedObjectFreezeV1(
  deriveProviderAcceptanceCompareAppendReceiptContentDigestV1,
);
CapturedObjectFreezeV1(
  projectProviderAcceptanceCurrentVersionTokenFieldsV1,
);
CapturedObjectFreezeV1(createProviderAcceptanceCurrentVersionTokenMessageV1);
CapturedObjectFreezeV1(
  createProviderAcceptanceCompareAppendReceiptTokenMessageV1,
);
CapturedObjectFreezeV1(deriveProviderAcceptanceCurrentPinV1);
CapturedObjectFreezeV1(deriveProviderAcceptanceCompareAppendReceiptPinV1);
