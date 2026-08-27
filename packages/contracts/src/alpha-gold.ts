import { z } from "zod";

import {
  GitObjectIdSchema,
  IsoTimestampSchema,
  OpaqueIdentifierSchema,
  RevisionSchema,
  SchemaVersionV1Schema,
  SnapshotIdSchema,
  TaskIdSchema,
} from "./primitives.js";

const ContentDigestV1Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/u);

export const STEP16_ALPHA_A_REVISION_V1 =
  "34da354968a6071d914e4e4a4fca738e6c2d8a29" as const;
export const STEP16_ALPHA_B_LOCAL_REVISION_V1 =
  "01aa1dac22db7d30e92818486190cef6b342fc18" as const;
export const STEP16_ALPHA_GOLD_BLOCKED_CORPUS_MANIFEST_DIGEST_V1 =
  "sha256:a28d28fde25d384407b304db732d37dae4a1d7eb20b4f7ffcfb9ed7bcaaf293b" as const;

export const AlphaGoldCorpusIdV1Schema = z.enum(["alpha-a", "alpha-b"]);

const AlphaGoldRequiredStagesV1Schema = z.tuple([
  z.literal("repo_pulse"),
  z.literal("task_brief"),
  z.literal("change_check"),
  z.literal("verification"),
]);

export const AlphaGoldTaskSlotV1Schema = z.strictObject({
  slotId: OpaqueIdentifierSchema,
  corpus: AlphaGoldCorpusIdV1Schema,
  ordinal: z.number().int().min(1).max(18),
  definitionStatus: z.literal("blocked_not_versioned"),
  requiredStages: AlphaGoldRequiredStagesV1Schema,
}).superRefine((slot, context) => {
  if (!/^alpha-[ab]-slot-\d{2}$/u.test(slot.slotId)) {
    context.addIssue({
      code: "custom",
      path: ["slotId"],
      message: "Gold runner slot ID has an invalid format",
    });
  }
  if (!slot.slotId.startsWith(slot.corpus)) {
    context.addIssue({
      code: "custom",
      path: ["slotId"],
      message: "Gold runner slot ID must be scoped to its corpus",
    });
  }
  const maximum = slot.corpus === "alpha-a" ? 18 : 6;
  if (slot.ordinal > maximum) {
    context.addIssue({
      code: "custom",
      path: ["ordinal"],
      message: "Gold runner slot ordinal exceeds the frozen corpus count",
    });
  }
});

export const AlphaGoldTaskCorpusV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  profile: z.literal("alpha_gold_task_corpus_v1"),
  corpusId: OpaqueIdentifierSchema,
  taskCount: z.literal(24),
  taskDefinitionStatus: z.literal("blocked_not_versioned"),
  sources: z.strictObject({
    alphaA: z.strictObject({
      policy: z.literal("repository_commit_pin"),
      repositoryKey: z.literal("understand-code"),
      stratum: z.literal("typescript_self_host_and_ts"),
      revision: GitObjectIdSchema,
      taskCount: z.literal(18),
    }),
    alphaB: z.strictObject({
      policy: z.literal("authorized_local_only"),
      stratum: z.literal("large_go_domain"),
      revision: GitObjectIdSchema,
      taskCount: z.literal(6),
      authorization: z.literal("explicit_repository_owner_authorization_required"),
      retention: z.literal("never_copy_source_private_evidence_or_absolute_paths"),
    }),
  }),
  coverageMinimums: z.strictObject({
    crossFile: z.literal(8),
    testImpact: z.literal(6),
    unplannedChange: z.literal(4),
    knownUnknownBoundary: z.literal(4),
  }),
  annotationPolicy: z.literal("two_person_review_required"),
  taskSlots: z.array(AlphaGoldTaskSlotV1Schema).length(24),
}).superRefine((manifest, context) => {
  const ids = manifest.taskSlots.map((slot) => slot.slotId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: "custom",
      path: ["taskSlots"],
      message: "Gold runner slot IDs must be unique",
    });
  }
  for (const [corpus, count] of [["alpha-a", 18], ["alpha-b", 6]] as const) {
    const slots = manifest.taskSlots
      .filter((slot) => slot.corpus === corpus)
      .map((slot) => slot.ordinal)
      .sort((left, right) => left - right);
    if (
      slots.length !== count ||
      slots.some((ordinal, index) => ordinal !== index + 1)
    ) {
      context.addIssue({
        code: "custom",
        path: ["taskSlots"],
        message: `Gold corpus ${corpus} must expose exactly ${count} contiguous blocked slots`,
      });
    }
  }
});

export type AlphaGoldTaskCorpusV1 = z.infer<
  typeof AlphaGoldTaskCorpusV1Schema
>;

export const AlphaGoldRunnerContractV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  profile: z.literal("alpha_gold_runner_contract_v1"),
  corpusProfile: z.literal("alpha_gold_task_corpus_v1"),
  taskSelection: z.literal("versioned_two_person_reviewed_definitions_only"),
  snapshotPolicy: z.literal("fresh_isolated_clean_commit_only_worktree_per_task"),
  requiredStages: AlphaGoldRequiredStagesV1Schema,
  g2: z.strictObject({
    minimumPassedTasksOnOneHost: z.literal(12),
    requiredHostCount: z.literal(1),
  }),
  g3: z.strictObject({
    requiredTasksPerHost: z.literal(24),
    requiredHostCount: z.literal(2),
    requiredHostTaskExecutions: z.literal(48),
    requiredHosts: z.tuple([z.literal("codex"), z.literal("claude")]),
    artifactTaskRevisionIdentity: z.literal("required"),
  }),
  syntheticSubstitution: z.literal("forbidden"),
  blockedEvidence: z.literal("machine_readable_required"),
  alphaBHandling: z.literal(
    "local_only_no_source_private_evidence_or_absolute_path_copy",
  ),
});

export type AlphaGoldRunnerContractV1 = z.infer<
  typeof AlphaGoldRunnerContractV1Schema
>;

const AlphaGoldHostExecutionCountShape = {
  requiredTasks: z.literal(24),
  alphaAPassedTasks: z.number().int().min(0).max(18),
  alphaBPassedTasks: z.number().int().min(0).max(6),
} as const;

const AlphaGoldHostExecutionV1Schema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("blocked"),
    requiredTasks: z.literal(24),
    passedTasks: z.literal(0),
    alphaAPassedTasks: z.literal(0),
    alphaBPassedTasks: z.literal(0),
  }),
  z.strictObject({
    status: z.literal("not_run"),
    requiredTasks: z.literal(24),
    passedTasks: z.literal(0),
    alphaAPassedTasks: z.literal(0),
    alphaBPassedTasks: z.literal(0),
  }),
  z.strictObject({
    status: z.literal("passed"),
    requiredTasks: z.literal(24),
    passedTasks: z.literal(24),
    alphaAPassedTasks: z.literal(18),
    alphaBPassedTasks: z.literal(6),
  }),
  z.strictObject({
    status: z.literal("g2_subset_passed"),
    ...AlphaGoldHostExecutionCountShape,
    passedTasks: z.number().int().min(1).max(23),
  }),
  z.strictObject({
    status: z.literal("failed"),
    ...AlphaGoldHostExecutionCountShape,
    passedTasks: z.number().int().min(0).max(23),
  }),
]).superRefine((execution, context) => {
  if (
    execution.passedTasks !==
    execution.alphaAPassedTasks + execution.alphaBPassedTasks
  ) {
    context.addIssue({
      code: "custom",
      path: ["passedTasks"],
      message: "Host pass count must equal its ALPHA-A and ALPHA-B pass counts",
    });
  }
});

export const AlphaGoldGateBlockerV1Schema = z.enum([
  "gold_task_definitions_not_versioned",
  "alpha_a_not_executed",
  "alpha_b_owner_authorization_missing",
  "alpha_b_authorized_local_corpus_unavailable",
  "codex_gold_incomplete",
  "claude_gold_incomplete",
  "artifact_task_revision_identity_mismatch",
]);

const AlphaGoldGateEvidenceCommonShape = {
  schemaVersion: SchemaVersionV1Schema,
  profile: z.literal("alpha_gold_gate_evidence_v1"),
  generatedAt: IsoTimestampSchema,
  syntheticVertical: z.strictObject({
    status: z.enum(["verified", "failed"]),
    countsTowardG2OrG3: z.literal(false),
    executionSurface: z.literal("installed_wrapper_stdio"),
    hostAuthority: z.literal("trusted_installation_wrappers_only"),
    hosts: z.tuple([z.literal("codex"), z.literal("claude")]),
    toolCount: z.literal(11),
  }),
  hostRuns: z.strictObject({
    codex: AlphaGoldHostExecutionV1Schema,
    claude: AlphaGoldHostExecutionV1Schema,
  }),
} as const;

const AlphaGoldAlphaASourceV1Schema = z.strictObject({
  revision: GitObjectIdSchema,
  materializableFromRepository: z.boolean(),
});

const AlphaGoldAlphaBSourceShape = {
  revision: GitObjectIdSchema,
  copiedIntoRepository: z.literal(false),
} as const;

const AlphaGoldSourcesUnavailableV1Schema = z.strictObject({
  alphaA: AlphaGoldAlphaASourceV1Schema,
  alphaB: z.union([
    z.strictObject({
      ...AlphaGoldAlphaBSourceShape,
      ownerAuthorizationObserved: z.literal(false),
      localCorpusAvailable: z.boolean(),
    }),
    z.strictObject({
      ...AlphaGoldAlphaBSourceShape,
      ownerAuthorizationObserved: z.literal(true),
      localCorpusAvailable: z.literal(false),
    }),
  ]),
});

const AlphaGoldSourcesAvailableV1Schema = z.strictObject({
  alphaA: z.strictObject({
    revision: GitObjectIdSchema,
    materializableFromRepository: z.literal(true),
  }),
  alphaB: z.strictObject({
    ...AlphaGoldAlphaBSourceShape,
    ownerAuthorizationObserved: z.literal(true),
    localCorpusAvailable: z.literal(true),
  }),
});

const AlphaGoldSourcesAnyV1Schema = z.strictObject({
  alphaA: AlphaGoldAlphaASourceV1Schema,
  alphaB: z.strictObject({
    ...AlphaGoldAlphaBSourceShape,
    ownerAuthorizationObserved: z.boolean(),
    localCorpusAvailable: z.boolean(),
  }),
});

const AlphaGoldBlockedG2V1Schema = z.strictObject({
  status: z.literal("blocked"),
  requiredPassedTasks: z.literal(12),
  blockers: z.array(AlphaGoldGateBlockerV1Schema).min(1),
});

const AlphaGoldAvailableG2V1Schema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("eligible"),
    requiredPassedTasks: z.literal(12),
    blockers: z.array(AlphaGoldGateBlockerV1Schema).length(0),
  }),
  z.strictObject({
    status: z.literal("blocked"),
    requiredPassedTasks: z.literal(12),
    blockers: z.array(AlphaGoldGateBlockerV1Schema).min(1),
  }),
]);

const AlphaGoldBlockedG3V1Schema = z.strictObject({
  status: z.literal("blocked"),
  requiredGoldTasksPerHost: z.literal(24),
  requiredHostTaskExecutions: z.literal(48),
  artifactTaskRevisionIdentityMatched: z.boolean(),
  blockers: z.array(AlphaGoldGateBlockerV1Schema).min(1),
});

const AlphaGoldAvailableG3V1Schema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("eligible"),
    requiredGoldTasksPerHost: z.literal(24),
    requiredHostTaskExecutions: z.literal(48),
    artifactTaskRevisionIdentityMatched: z.literal(true),
    blockers: z.array(AlphaGoldGateBlockerV1Schema).length(0),
  }),
  AlphaGoldBlockedG3V1Schema,
]);

const AlphaGoldDefinitionsBlockedGateEvidenceV1Schema = z.strictObject({
  ...AlphaGoldGateEvidenceCommonShape,
  corpusManifestDigest: ContentDigestV1Schema,
  taskDefinitionStatus: z.literal("blocked_not_versioned"),
  sources: AlphaGoldSourcesAnyV1Schema,
  g2: AlphaGoldBlockedG2V1Schema,
  g3: AlphaGoldBlockedG3V1Schema,
});

export const AlphaGoldGateEvidenceV1Schema = z.union([
  AlphaGoldDefinitionsBlockedGateEvidenceV1Schema,
  z.strictObject({
    ...AlphaGoldGateEvidenceCommonShape,
    versionedTaskDefinitionManifestDigest: ContentDigestV1Schema,
    taskDefinitionStatus: z.literal("versioned_two_person_reviewed"),
    sources: AlphaGoldSourcesUnavailableV1Schema,
    g2: AlphaGoldBlockedG2V1Schema,
    g3: AlphaGoldBlockedG3V1Schema,
  }),
  z.strictObject({
    ...AlphaGoldGateEvidenceCommonShape,
    versionedTaskDefinitionManifestDigest: ContentDigestV1Schema,
    taskDefinitionStatus: z.literal("versioned_two_person_reviewed"),
    sources: AlphaGoldSourcesAvailableV1Schema,
    g2: AlphaGoldAvailableG2V1Schema,
    g3: AlphaGoldAvailableG3V1Schema,
  }),
]).superRefine((evidence, context) => {
  const qualifyingPassCount = (host: "codex" | "claude") => {
    const run = evidence.hostRuns[host];
    return run.status === "passed" || run.status === "g2_subset_passed"
      ? run.passedTasks
      : 0;
  };
  const maxQualifyingHostPassedTasks = Math.max(
    qualifyingPassCount("codex"),
    qualifyingPassCount("claude"),
  );
  const prerequisitesAvailable =
    evidence.taskDefinitionStatus === "versioned_two_person_reviewed" &&
    evidence.sources.alphaA.materializableFromRepository &&
    evidence.sources.alphaB.ownerAuthorizationObserved &&
    evidence.sources.alphaB.localCorpusAvailable;
  const g2Eligible =
    prerequisitesAvailable && maxQualifyingHostPassedTasks >= 12;
  if (
    (evidence.g2.status === "eligible") !== g2Eligible ||
    (g2Eligible
      ? evidence.g2.blockers.length !== 0
      : evidence.g2.blockers.length === 0)
  ) {
    context.addIssue({
      code: "custom",
      path: ["g2"],
      message: "G2 is eligible exactly when one Host passes at least 12 Gold tasks",
    });
  }

  const g3Eligible =
    prerequisitesAvailable &&
    evidence.hostRuns.codex.status === "passed" &&
    evidence.hostRuns.claude.status === "passed" &&
    evidence.g3.artifactTaskRevisionIdentityMatched;
  if (
    (evidence.g3.status === "eligible") !== g3Eligible ||
    (g3Eligible
      ? evidence.g3.blockers.length !== 0
      : evidence.g3.blockers.length === 0)
  ) {
    context.addIssue({
      code: "custom",
      path: ["g3"],
      message: "G3 requires Codex and Claude to each pass all 24 Gold tasks with identical artifacts",
    });
  }
});

export type AlphaGoldGateEvidenceV1 = z.infer<
  typeof AlphaGoldGateEvidenceV1Schema
>;

const Step16BlockedEvidenceCommonShape = {
  schemaVersion: SchemaVersionV1Schema,
  profile: z.literal("step16_dual_host_strong_alpha_linux_v1"),
  status: z.literal("blocked"),
  hosts: z.tuple([z.literal("codex"), z.literal("claude")]),
  toolCount: z.literal(11),
  goldGate: AlphaGoldDefinitionsBlockedGateEvidenceV1Schema,
} as const;

export const Step16DualHostBlockedEvidenceV1Schema = z.union([
  z.strictObject({
    ...Step16BlockedEvidenceCommonShape,
    hostExecution: z.strictObject({
      status: z.literal("blocked"),
      blocker: z.literal("real_host_clis_unavailable"),
    }),
    syntheticVertical: z.strictObject({
      status: z.literal("failed"),
      executionSurface: z.literal("installed_wrapper_stdio"),
      hostAuthority: z.literal("trusted_installation_wrappers_only"),
    }),
    rootFailClosed: z.literal("not_run"),
    externalSourceMutation: z.literal("not_run"),
    sharedArtifacts: z.literal("not_run"),
    lifecycle: z.literal("not_run"),
  }),
  z.strictObject({
    ...Step16BlockedEvidenceCommonShape,
    hostExecution: z.strictObject({
      status: z.literal("blocked"),
      blocker: z.literal("real_host_tool_call_not_exercised"),
    }),
    syntheticVertical: z.strictObject({
      status: z.literal("verified"),
      executionSurface: z.literal("installed_wrapper_stdio"),
      hostAuthority: z.literal("trusted_installation_wrappers_only"),
      independentInstallations: z.literal(true),
      providerBinding: z.literal("self_relative_owned_activation"),
      ambientSelection: z.literal("poisoned_environment_ignored"),
    }),
    rootFailClosed: z.literal("verified_both_hosts_zero_write"),
    externalSourceMutation: z.literal("verified"),
    taskId: TaskIdSchema,
    taskRevision: RevisionSchema,
    taskStatus: z.literal("verified"),
    baselineSnapshotId: SnapshotIdSchema,
    actualSnapshotId: SnapshotIdSchema,
    evidenceCount: z.number().int().positive(),
    providerRevision: RevisionSchema,
    sharedArtifacts: z.literal("byte_equivalent_public_results"),
    lifecycle: z.enum([
      "marketplace_installed_selector_verified_clean_close",
      "marketplace_install_upgrade_reinstall_remove_doctor_clean_close",
    ]),
  }),
]);

export type Step16DualHostBlockedEvidenceV1 = z.infer<
  typeof Step16DualHostBlockedEvidenceV1Schema
>;

const Step16PassedGoldHostRunV1Schema = z.strictObject({
  status: z.literal("passed"),
  requiredTasks: z.literal(24),
  passedTasks: z.literal(24),
  alphaAPassedTasks: z.literal(18),
  alphaBPassedTasks: z.literal(6),
});

const Step16EligibleGoldGateV1Schema = z.strictObject({
  ...AlphaGoldGateEvidenceCommonShape,
  taskDefinitionStatus: z.literal("versioned_two_person_reviewed"),
  syntheticVertical: z.strictObject({
    status: z.literal("verified"),
    countsTowardG2OrG3: z.literal(false),
    executionSurface: z.literal("installed_wrapper_stdio"),
    hostAuthority: z.literal("trusted_installation_wrappers_only"),
    hosts: z.tuple([z.literal("codex"), z.literal("claude")]),
    toolCount: z.literal(11),
  }),
  sources: z.strictObject({
    alphaA: z.strictObject({
      revision: z.literal(STEP16_ALPHA_A_REVISION_V1),
      materializableFromRepository: z.literal(true),
    }),
    alphaB: z.strictObject({
      revision: z.literal(STEP16_ALPHA_B_LOCAL_REVISION_V1),
      ownerAuthorizationObserved: z.literal(true),
      localCorpusAvailable: z.literal(true),
      copiedIntoRepository: z.literal(false),
    }),
  }),
  hostRuns: z.strictObject({
    codex: Step16PassedGoldHostRunV1Schema,
    claude: Step16PassedGoldHostRunV1Schema,
  }),
  g2: z.strictObject({
    status: z.literal("eligible"),
    requiredPassedTasks: z.literal(12),
    blockers: z.tuple([]),
  }),
  g3: z.strictObject({
    status: z.literal("eligible"),
    requiredGoldTasksPerHost: z.literal(24),
    requiredHostTaskExecutions: z.literal(48),
    artifactTaskRevisionIdentityMatched: z.literal(true),
    blockers: z.tuple([]),
  }),
});

const Step16GoldSlotDescriptorsV1 = [
  ...Array.from({ length: 18 }, (_, index) => ({
    slotId: `alpha-a-slot-${String(index + 1).padStart(2, "0")}`,
    corpus: "alpha-a" as const,
    ordinal: index + 1,
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    slotId: `alpha-b-slot-${String(index + 1).padStart(2, "0")}`,
    corpus: "alpha-b" as const,
    ordinal: index + 1,
  })),
] as const;

function step16PassedHostToolCallV1(tool: string) {
  return z.strictObject({
    status: z.literal("passed"),
    tool: z.literal(tool),
    realHostCallReceiptDigest: ContentDigestV1Schema,
  });
}

function step16PassedHostTaskProofV1(host: "codex" | "claude") {
  return z.strictObject({
    host: z.literal(host),
    status: z.literal("passed"),
    taskRunReceiptDigest: ContentDigestV1Schema,
    stages: z.strictObject({
      repoPulse: step16PassedHostToolCallV1("get_repo_pulse"),
      refreshBaseline: step16PassedHostToolCallV1("refresh_index"),
      taskBrief: step16PassedHostToolCallV1("build_task_brief"),
      taskUpdate: step16PassedHostToolCallV1("update_task"),
      refreshChanged: step16PassedHostToolCallV1("refresh_index"),
      changeCheck: step16PassedHostToolCallV1("check_change"),
      verification: step16PassedHostToolCallV1("record_verification"),
    }),
    externalSourceMutation: z.strictObject({
      status: z.literal("passed"),
      receiptDigest: ContentDigestV1Schema,
    }),
  });
}

function step16GoldSlotProofV1(
  slotId: string,
  corpus: "alpha-a" | "alpha-b",
  ordinal: number,
) {
  return z.strictObject({
    slotId: z.literal(slotId),
    corpus: z.literal(corpus),
    ordinal: z.literal(ordinal),
    taskDefinitionDigest: ContentDigestV1Schema,
    sharedExecutionIdentity: z.strictObject({
      providerIdentityDigest: ContentDigestV1Schema,
      taskId: TaskIdSchema,
      revision: RevisionSchema,
    }),
    sharedArtifactDigest: ContentDigestV1Schema,
    sharedExternalSourceMutationDigest: ContentDigestV1Schema,
    hosts: z.strictObject({
      codex: step16PassedHostTaskProofV1("codex"),
      claude: step16PassedHostTaskProofV1("claude"),
    }),
  });
}

const Step16GoldProofSlotsV1Schema = z.strictObject(
  Object.fromEntries(
    Step16GoldSlotDescriptorsV1.map(({ slotId, corpus, ordinal }) => [
      slotId,
      step16GoldSlotProofV1(slotId, corpus, ordinal),
    ]),
  ) as Record<string, z.ZodType>,
);

const Step16EligibleHostExecutionV1Schema = (
  host: "codex" | "claude",
) => z.strictObject({
  host: z.literal(host),
  status: z.literal("passed"),
  installationMode: z.literal("real_marketplace_plugin_installation"),
  installationReceiptDigest: ContentDigestV1Schema,
  activationReceiptDigest: ContentDigestV1Schema,
  rootFailClosedReceiptDigest: ContentDigestV1Schema,
  passedGoldTasks: z.literal(24),
});

/**
 * Strict transport shape for future evidence produced by real Host tool calls.
 * Parsing this shape never asserts that an execution occurred; only collected
 * receipts from the mandatory closing gate may do that.
 */
export const Step16DualHostEligibleEvidenceV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  profile: z.literal("step16_dual_host_strong_alpha_linux_v1"),
  status: z.literal("eligible"),
  hosts: z.tuple([z.literal("codex"), z.literal("claude")]),
  hostExecution: z.strictObject({
    status: z.literal("eligible"),
    executionSurface: z.literal("real_host_tool_calls"),
    installations: z.strictObject({
      codex: Step16EligibleHostExecutionV1Schema("codex"),
      claude: Step16EligibleHostExecutionV1Schema("claude"),
    }),
  }),
  syntheticVertical: z.strictObject({
    status: z.literal("verified"),
    executionSurface: z.literal("installed_wrapper_stdio"),
    hostAuthority: z.literal("trusted_installation_wrappers_only"),
    independentInstallations: z.literal(true),
    providerBinding: z.literal("self_relative_owned_activation"),
    ambientSelection: z.literal("poisoned_environment_ignored"),
  }),
  toolCount: z.literal(11),
  rootFailClosed: z.literal("verified_both_hosts_zero_write"),
  externalSourceMutation: z.literal("verified_all_gold_tasks_both_hosts"),
  sharedArtifacts: z.literal("single_shared_digest_per_task"),
  lifecycle: z.literal(
    "marketplace_install_upgrade_reinstall_remove_doctor_clean_close",
  ),
  proof: z.strictObject({
    versionedTaskDefinitionManifestDigest: ContentDigestV1Schema,
    sourceBindings: z.strictObject({
      alphaA: z.strictObject({
        repositoryKey: z.literal("understand-code"),
        repositoryRevision: z.literal(STEP16_ALPHA_A_REVISION_V1),
      }),
      alphaB: z.strictObject({
        localRevision: z.literal(STEP16_ALPHA_B_LOCAL_REVISION_V1),
        ownerAuthorizationObserved: z.literal(true),
        ownerAuthorizationReceiptDigest: ContentDigestV1Schema,
        localCorpusAvailable: z.literal(true),
        copiedIntoRepository: z.literal(false),
        retention: z.literal(
          "never_copy_source_private_evidence_or_absolute_paths",
        ),
      }),
    }),
    slots: Step16GoldProofSlotsV1Schema,
    rootVerification: z.strictObject({
      profile: z.literal("step16_gold_receipt_root_verification_v1"),
      status: z.literal("verified"),
      verifierKeyId: z.string().regex(/^ed25519-spki-sha256:[0-9a-f]{64}$/u),
      receiptInventoryDigest: ContentDigestV1Schema,
      signature: z.string().regex(/^ed25519:[0-9a-f]{128}$/u),
    }),
  }),
  goldGate: Step16EligibleGoldGateV1Schema,
});

export type Step16DualHostEligibleEvidenceV1 = z.infer<
  typeof Step16DualHostEligibleEvidenceV1Schema
>;

export const Step16DualHostEvidenceV1Schema = z.union([
  Step16DualHostBlockedEvidenceV1Schema,
  Step16DualHostEligibleEvidenceV1Schema,
]);

export type Step16DualHostEvidenceV1 = z.infer<
  typeof Step16DualHostEvidenceV1Schema
>;
