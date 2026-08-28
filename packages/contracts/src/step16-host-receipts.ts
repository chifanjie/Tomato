import { z } from "zod";

import { canonicalizeJson } from "./canonical-json.js";
import { P0McpToolNameV1Schema } from "./mcp.js";
import {
  ContentDigestSchema,
  RevisionSchema,
  SchemaVersionV1Schema,
  TaskIdSchema,
} from "./primitives.js";

export const STEP16_MCP_SERVER_NAME_V1 = "understand-code" as const;
export const STEP16_EXPECTED_HOST_EVENT_PLAN_DIGEST_DOMAIN_V1 =
  "understand-code-step16-expected-host-event-plan-v1" as const;

export const Step16HostV1Schema = z.enum(["codex", "claude"]);
export type Step16HostV1 = z.infer<typeof Step16HostV1Schema>;

const Step16TaskSlotIdV1Schema = z.string().regex(
  /^(?:alpha-a-slot-(?:0[1-9]|1[0-8])|alpha-b-slot-0[1-6])$/u,
);

const Step16ProviderOperationNonceV1Schema = z
  .string()
  .regex(/^[0-9a-f]{32}$/u);

const Step16EventOrdinalV1Schema = z.number().int().min(1).max(256);

const uniqueDigestsV1 = (
  digests: readonly string[],
  context: z.RefinementCtx,
  message: string,
): void => {
  if (new Set(digests).size !== digests.length) {
    context.addIssue({ code: "custom", message });
  }
};

/** Path-free projection of one real Codex or Claude MCP Tool Call. */
export const Step16RealHostToolCallReceiptV1Schema = z.strictObject({
  kind: z.literal("mcp_tool_call"),
  server: z.literal(STEP16_MCP_SERVER_NAME_V1),
  tool: P0McpToolNameV1Schema,
  ordinal: Step16EventOrdinalV1Schema,
  callIdDigest: ContentDigestSchema,
  argumentsDigest: ContentDigestSchema,
  resultDigest: ContentDigestSchema,
  success: z.literal(true),
});

export type Step16RealHostToolCallReceiptV1 = z.infer<
  typeof Step16RealHostToolCallReceiptV1Schema
>;

/**
 * Path- and command-free projection of a non-MCP Host action. Digests bind the
 * private input/result while the public receipt exposes only the canonical
 * action and mechanism taxonomy.
 */
const Step16RealHostActionReceiptCommonShapeV1 = {
  kind: z.literal("host_action"),
  ordinal: Step16EventOrdinalV1Schema,
  actionIdDigest: ContentDigestSchema,
  inputDigest: ContentDigestSchema,
  resultDigest: ContentDigestSchema,
  success: z.literal(true),
} as const;

export const Step16RealHostActionReceiptV1Schema = z.discriminatedUnion(
  "action",
  [
    z.strictObject({
      ...Step16RealHostActionReceiptCommonShapeV1,
      action: z.literal("source_mutation"),
      mechanism: z.literal("file_change"),
    }),
    z.strictObject({
      ...Step16RealHostActionReceiptCommonShapeV1,
      action: z.literal("verification"),
      mechanism: z.literal("command_execution"),
    }),
  ],
);

export type Step16RealHostActionReceiptV1 = z.infer<
  typeof Step16RealHostActionReceiptV1Schema
>;

export const Step16RealHostEventV1Schema = z.union([
  Step16RealHostToolCallReceiptV1Schema,
  Step16RealHostActionReceiptV1Schema,
]);

export type Step16RealHostEventV1 = z.infer<
  typeof Step16RealHostEventV1Schema
>;

function step16EventIdDigestV1(event: Step16RealHostEventV1): string {
  return event.kind === "mcp_tool_call"
    ? event.callIdDigest
    : event.actionIdDigest;
}

/**
 * Strict public projection of every relevant event in one non-interactive Host
 * session. Raw JSONL, model text, arguments/results, commands, paths, content,
 * and session/event IDs deliberately have no field in this shape.
 */
export const Step16RealHostTranscriptReceiptV1Schema = z
  .strictObject({
    schemaVersion: SchemaVersionV1Schema,
    host: Step16HostV1Schema,
    sessionIdDigest: ContentDigestSchema,
    events: z.array(Step16RealHostEventV1Schema).min(1).max(256),
  })
  .superRefine((receipt, context) => {
    uniqueDigestsV1(
      receipt.events.map(step16EventIdDigestV1),
      context,
      "Host transcript event ID digests must be globally unique",
    );
    if (receipt.events.some((event, index) => event.ordinal !== index + 1)) {
      context.addIssue({
        code: "custom",
        path: ["events"],
        message: "Host transcript ordinals must be globally contiguous and ordered",
      });
    }
  });

export type Step16RealHostTranscriptReceiptV1 = z.infer<
  typeof Step16RealHostTranscriptReceiptV1Schema
>;

const Step16ExpectedHostMcpToolCallV1Schema = z.strictObject({
  kind: z.literal("mcp_tool_call"),
  ordinal: Step16EventOrdinalV1Schema,
  server: z.literal(STEP16_MCP_SERVER_NAME_V1),
  tool: P0McpToolNameV1Schema,
});

const Step16ExpectedHostActionCommonShapeV1 = {
  kind: z.literal("host_action"),
  ordinal: Step16EventOrdinalV1Schema,
  inputDigest: ContentDigestSchema,
} as const;

const Step16ExpectedHostActionV1Schema = z.discriminatedUnion("action", [
  z.strictObject({
    ...Step16ExpectedHostActionCommonShapeV1,
    action: z.literal("source_mutation"),
    mechanism: z.literal("file_change"),
  }),
  z.strictObject({
    ...Step16ExpectedHostActionCommonShapeV1,
    action: z.literal("verification"),
    mechanism: z.literal("command_execution"),
  }),
]);

export const Step16ExpectedHostEventV1Schema = z.union([
  Step16ExpectedHostMcpToolCallV1Schema,
  Step16ExpectedHostActionV1Schema,
]);

/** Versioned task-definition input to the builder, never transcript data. */
export const Step16ExpectedHostEventPlanV1Schema = z
  .strictObject({
    expectedEventPlanDigest: ContentDigestSchema,
    events: z.array(Step16ExpectedHostEventV1Schema).min(1).max(256),
  })
  .superRefine((plan, context) => {
    if (plan.events.some((event, index) => event.ordinal !== index + 1)) {
      context.addIssue({
        code: "custom",
        path: ["events"],
        message: "Expected Host event ordinals must be contiguous and ordered",
      });
    }
  });

export type Step16ExpectedHostEventPlanV1 = z.infer<
  typeof Step16ExpectedHostEventPlanV1Schema
>;

/** Browser-portable digest of the canonical, validated expected event sequence. */
export async function deriveStep16ExpectedHostEventPlanDigestV1(
  eventsInput: z.input<typeof Step16ExpectedHostEventV1Schema>[],
): Promise<z.infer<typeof ContentDigestSchema>> {
  const events = z.array(Step16ExpectedHostEventV1Schema).min(1).max(256).parse(
    eventsInput,
  );
  const portableRuntime = globalThis as unknown as {
    readonly TextEncoder?: new () => {
      encode(value: string): Uint8Array;
    };
    readonly crypto?: {
      readonly subtle?: {
        digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
      };
    };
  };
  if (
    portableRuntime.TextEncoder === undefined ||
    portableRuntime.crypto?.subtle === undefined
  ) {
    throw new TypeError("Web Crypto SHA-256 is unavailable");
  }
  const bytes = new portableRuntime.TextEncoder().encode(
    `${STEP16_EXPECTED_HOST_EVENT_PLAN_DIGEST_DOMAIN_V1}\u0000${canonicalizeJson(events)}`,
  );
  const digestBytes = new Uint8Array(
    await portableRuntime.crypto.subtle.digest("SHA-256", bytes),
  );
  const hex = Array.from(digestBytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return ContentDigestSchema.parse(`sha256:${hex}`);
}

function fixedTraversalDigestEqualV1(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length, 71);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/**
 * Public binding to a full Provider receipt bundle kept in the root-owned
 * private ledger. The closing verifier loads the original request, signed
 * response, principal attestation, and authority grant through a fixed
 * no-follow locator and verifies these component digests and signatures.
 */
export const Step16ProviderReceiptBindingV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  profile: z.literal("step16_provider_receipt_binding_v1"),
  host: Step16HostV1Schema,
  sessionIdDigest: ContentDigestSchema,
  callIdDigest: ContentDigestSchema,
  providerIdentityDigest: ContentDigestSchema,
  receiptLedger: z.strictObject({
    authority: z.literal("root_owned_private_provider_receipt_ledger"),
    locatorPolicy: z.literal("fixed_locator_component_nofollow"),
    receiptBundleDigest: ContentDigestSchema,
  }),
  providerOperation: z.strictObject({
    operation: z.enum(["write_object", "compare_commit"]),
    operationNonce: Step16ProviderOperationNonceV1Schema,
    requestDigest: ContentDigestSchema,
    sessionBindingDigest: ContentDigestSchema,
    principalAttestationDigest: ContentDigestSchema,
    authorityGrantContentDigest: ContentDigestSchema,
    responseResolution: z.enum(["committed", "replayed"]),
  }),
  componentDigests: z.strictObject({
    strongMutationRequest: ContentDigestSchema,
    strongMutationResponse: ContentDigestSchema,
    principalAttestation: ContentDigestSchema,
    authorityGrantEnvelope: ContentDigestSchema,
    authorityGrantSignature: ContentDigestSchema,
    responseSignature: ContentDigestSchema,
    principalAttestationSignature: ContentDigestSchema,
  }),
  privateBundleVerification: z.strictObject({
    status: z.literal("verified"),
    verifierProfile: z.literal(
      "provider_runtime_ipc_full_private_bundle_verifier_v1",
    ),
    verifiedBindings: z.tuple([
      z.literal("request_digest"),
      z.literal("session_binding"),
      z.literal("authority_grant_signature"),
      z.literal("response_signature"),
      z.literal("principal_attestation_signature"),
    ]),
  }),
});

export type Step16ProviderReceiptBindingV1 = z.infer<
  typeof Step16ProviderReceiptBindingV1Schema
>;

const Step16ProviderBundlesForHostCallV1Schema = z
  .strictObject({
    callIdDigest: ContentDigestSchema,
    receiptBundleDigests: z.array(ContentDigestSchema).min(1).max(4_096),
  })
  .superRefine((binding, context) => {
    uniqueDigestsV1(
      binding.receiptBundleDigests,
      context,
      "Provider receipt bundle digests must be unique within a Host call",
    );
  });

const requiredStageV1 = (tool: z.input<typeof P0McpToolNameV1Schema>) =>
  z.strictObject({
    tool: z.literal(tool),
    callIdDigest: ContentDigestSchema,
  });

const Step16RequiredStageReceiptsV1Schema = z.strictObject({
  repoPulse: requiredStageV1("get_repo_pulse"),
  refreshBaseline: requiredStageV1("refresh_index"),
  taskBrief: requiredStageV1("build_task_brief"),
  taskUpdate: requiredStageV1("update_task"),
  refreshChanged: requiredStageV1("refresh_index"),
  changeCheck: requiredStageV1("check_change"),
  verification: requiredStageV1("record_verification"),
});

const REQUIRED_STAGE_KEYS_V1 = [
  "repoPulse",
  "refreshBaseline",
  "taskBrief",
  "taskUpdate",
  "refreshChanged",
  "changeCheck",
  "verification",
] as const;

const requiredHostActionV1 = (action: "source_mutation" | "verification") =>
  z.strictObject({
    action: z.literal(action),
    actionIdDigest: ContentDigestSchema,
  });

const Step16RequiredHostActionsV1Schema = z.strictObject({
  sourceMutation: requiredHostActionV1("source_mutation"),
  verification: z
    .array(requiredHostActionV1("verification"))
    .min(1)
    .max(256),
});

const STEP16_STRONG_MUTATION_TOOLS_V1 = new Set([
  "build_task_brief",
  "update_task",
  "check_change",
  "record_verification",
  "refresh_index",
]);

const Step16ReceiptInventoryBaseV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  profile: z.literal("step16_receipt_inventory_v1"),
  authority: z.literal("structural_receipt_inventory_not_gold_eligibility"),
  expectedEventPlanDigest: ContentDigestSchema,
  taskSlotId: Step16TaskSlotIdV1Schema,
  taskDefinitionDigest: ContentDigestSchema,
  executionIdentity: z.strictObject({
    taskId: TaskIdSchema,
    revision: RevisionSchema,
    providerIdentityDigest: ContentDigestSchema,
  }),
  transcript: Step16RealHostTranscriptReceiptV1Schema,
  requiredStages: Step16RequiredStageReceiptsV1Schema,
  requiredHostActions: Step16RequiredHostActionsV1Schema,
  strongCallProviderReceipts: z
    .array(Step16ProviderBundlesForHostCallV1Schema)
    .min(6)
    .max(256),
  providerBindings: z
    .array(Step16ProviderReceiptBindingV1Schema)
    .min(6)
    .max(4_096),
});

/**
 * Exact Provider inventory plus required MCP-stage and Host-action selections
 * for one complete Host session. Parsing proves structural completeness only;
 * it never grants Gold eligibility.
 */
export const Step16ReceiptInventoryV1Schema =
  Step16ReceiptInventoryBaseV1Schema.superRefine((inventory, context) => {
    const mcpCalls = inventory.transcript.events.filter(
      (event): event is Step16RealHostToolCallReceiptV1 =>
        event.kind === "mcp_tool_call",
    );
    const hostActions = inventory.transcript.events.filter(
      (event): event is Step16RealHostActionReceiptV1 =>
        event.kind === "host_action",
    );
    const callsById = new Map(mcpCalls.map((call) => [call.callIdDigest, call]));
    const actionsById = new Map(
      hostActions.map((action) => [action.actionIdDigest, action]),
    );

    let previousRequiredStageOrdinal = 0;
    const requiredCallIds: string[] = [];
    const requiredStageCalls = new Map<string, Step16RealHostToolCallReceiptV1>();
    for (const stageKey of REQUIRED_STAGE_KEYS_V1) {
      const stage = inventory.requiredStages[stageKey];
      requiredCallIds.push(stage.callIdDigest);
      const call = callsById.get(stage.callIdDigest);
      if (call === undefined || call.tool !== stage.tool) {
        context.addIssue({
          code: "custom",
          path: ["requiredStages", stageKey],
          message: "Required stage must select a matching MCP Tool Call event",
        });
        continue;
      }
      requiredStageCalls.set(stageKey, call);
      if (call.ordinal <= previousRequiredStageOrdinal) {
        context.addIssue({
          code: "custom",
          path: ["requiredStages", stageKey],
          message: "Required stages must select distinct calls in execution order",
        });
      }
      previousRequiredStageOrdinal = call.ordinal;
    }
    if (new Set(requiredCallIds).size !== requiredCallIds.length) {
      context.addIssue({
        code: "custom",
        path: ["requiredStages"],
        message: "Required stages must select seven distinct MCP events",
      });
    }

    const sourceMutationSelection = inventory.requiredHostActions.sourceMutation;
    const sourceMutation = actionsById.get(
      sourceMutationSelection.actionIdDigest,
    );
    if (sourceMutation?.action !== sourceMutationSelection.action) {
      context.addIssue({
        code: "custom",
        path: ["requiredHostActions", "sourceMutation"],
        message: "Source mutation selection must reference a matching Host action",
      });
    } else {
      const taskUpdate = requiredStageCalls.get("taskUpdate");
      const refreshChanged = requiredStageCalls.get("refreshChanged");
      if (
        taskUpdate === undefined ||
        refreshChanged === undefined ||
        sourceMutation.ordinal <= taskUpdate.ordinal ||
        sourceMutation.ordinal >= refreshChanged.ordinal
      ) {
        context.addIssue({
          code: "custom",
          path: ["requiredHostActions", "sourceMutation"],
          message: "Source mutation must follow plan confirmation and precede changed refresh",
        });
      }
    }

    const verificationSelections = inventory.requiredHostActions.verification;
    const verificationActionIds = verificationSelections.map(
      (selection) => selection.actionIdDigest,
    );
    uniqueDigestsV1(
      verificationActionIds,
      context,
      "Verification selections must reference distinct Host actions",
    );
    const changeCheck = requiredStageCalls.get("changeCheck");
    const recordVerification = requiredStageCalls.get("verification");
    let previousVerificationOrdinal = changeCheck?.ordinal ?? 0;
    for (const [index, selection] of verificationSelections.entries()) {
      const action = actionsById.get(selection.actionIdDigest);
      if (action?.action !== selection.action) {
        context.addIssue({
          code: "custom",
          path: ["requiredHostActions", "verification", index],
          message: "Verification selection must reference a matching Host action",
        });
        continue;
      }
      if (
        changeCheck === undefined ||
        recordVerification === undefined ||
        action.ordinal <= previousVerificationOrdinal ||
        action.ordinal >= recordVerification.ordinal
      ) {
        context.addIssue({
          code: "custom",
          path: ["requiredHostActions", "verification", index],
          message: "Verification actions must follow Check and precede record_verification in order",
        });
      }
      previousVerificationOrdinal = action.ordinal;
    }

    const strongCalls = mcpCalls.filter((call) =>
      STEP16_STRONG_MUTATION_TOOLS_V1.has(call.tool),
    );
    if (inventory.strongCallProviderReceipts.length !== strongCalls.length) {
      context.addIssue({
        code: "custom",
        path: ["strongCallProviderReceipts"],
        message: "Every strong mutation MCP event requires one Provider receipt group",
      });
    }
    for (
      let index = 0;
      index < inventory.strongCallProviderReceipts.length;
      index += 1
    ) {
      if (
        inventory.strongCallProviderReceipts[index]!.callIdDigest !==
        strongCalls[index]?.callIdDigest
      ) {
        context.addIssue({
          code: "custom",
          path: ["strongCallProviderReceipts", index, "callIdDigest"],
          message: "Provider receipt groups must exact-cover strong MCP events in order",
        });
      }
    }

    const expectedBindings = inventory.strongCallProviderReceipts.flatMap(
      (group) => group.receiptBundleDigests.map((receiptBundleDigest) => ({
        callIdDigest: group.callIdDigest,
        receiptBundleDigest,
      })),
    );
    uniqueDigestsV1(
      expectedBindings.map((binding) => binding.receiptBundleDigest),
      context,
      "Provider receipt bundle digests must be unique across the inventory",
    );
    if (inventory.providerBindings.length !== expectedBindings.length) {
      context.addIssue({
        code: "custom",
        path: ["providerBindings"],
        message: "Provider bindings must exactly cover every declared private bundle",
      });
    }

    uniqueDigestsV1(
      inventory.providerBindings.map(
        (binding) => binding.receiptLedger.receiptBundleDigest,
      ),
      context,
      "Provider receipt bindings must not contain duplicate bundles",
    );
    uniqueDigestsV1(
      inventory.providerBindings.map(
        (binding) => binding.componentDigests.strongMutationRequest,
      ),
      context,
      "Provider request components must not be paired more than once",
    );
    uniqueDigestsV1(
      inventory.providerBindings.map(
        (binding) => binding.componentDigests.strongMutationResponse,
      ),
      context,
      "Provider response components must not be paired more than once",
    );
    const operationNonces = inventory.providerBindings.map(
      (binding) => binding.providerOperation.operationNonce,
    );
    if (new Set(operationNonces).size !== operationNonces.length) {
      context.addIssue({
        code: "custom",
        path: ["providerBindings"],
        message: "Provider operation nonces must not be paired more than once",
      });
    }

    for (let index = 0; index < inventory.providerBindings.length; index += 1) {
      const binding = inventory.providerBindings[index]!;
      const expected = expectedBindings[index];
      if (
        expected === undefined ||
        binding.callIdDigest !== expected.callIdDigest ||
        binding.receiptLedger.receiptBundleDigest !== expected.receiptBundleDigest
      ) {
        context.addIssue({
          code: "custom",
          path: ["providerBindings", index],
          message: "Provider bindings must follow the exact call and bundle order",
        });
      }
      if (
        binding.host !== inventory.transcript.host ||
        binding.sessionIdDigest !== inventory.transcript.sessionIdDigest ||
        binding.providerIdentityDigest !==
          inventory.executionIdentity.providerIdentityDigest
      ) {
        context.addIssue({
          code: "custom",
          path: ["providerBindings", index],
          message: "Provider binding identity must match the Host inventory",
        });
      }
    }
  });

export type Step16ReceiptInventoryV1 = z.infer<
  typeof Step16ReceiptInventoryV1Schema
>;

export type CreateStep16ReceiptInventoryV1Input = Omit<
  z.input<typeof Step16ReceiptInventoryBaseV1Schema>,
  "schemaVersion" | "profile" | "authority" | "expectedEventPlanDigest"
>;

function step16EventMatchesPlanV1(
  event: Step16RealHostEventV1,
  expected: z.infer<typeof Step16ExpectedHostEventV1Schema>,
): boolean {
  if (event.kind !== expected.kind || event.ordinal !== expected.ordinal) {
    return false;
  }
  if (event.kind === "mcp_tool_call" && expected.kind === "mcp_tool_call") {
    return event.server === expected.server && event.tool === expected.tool;
  }
  return event.kind === "host_action" &&
    expected.kind === "host_action" &&
    event.action === expected.action &&
    event.mechanism === expected.mechanism &&
    event.inputDigest === expected.inputDigest;
}

/**
 * Builds an inventory only after comparing the complete global event sequence
 * against the external, versioned task-definition plan. The transcript cannot
 * choose or weaken its own expected sequence.
 */
export async function createStep16ReceiptInventoryV1(
  input: CreateStep16ReceiptInventoryV1Input,
  expectedEventPlanInput: z.input<typeof Step16ExpectedHostEventPlanV1Schema>,
): Promise<Step16ReceiptInventoryV1> {
  const expectedEventPlan = Step16ExpectedHostEventPlanV1Schema.parse(
    expectedEventPlanInput,
  );
  const transcript = Step16RealHostTranscriptReceiptV1Schema.parse(
    input.transcript,
  );
  const derivedPlanDigest = await deriveStep16ExpectedHostEventPlanDigestV1(
    expectedEventPlan.events,
  );
  if (
    !fixedTraversalDigestEqualV1(
      expectedEventPlan.expectedEventPlanDigest,
      derivedPlanDigest,
    )
  ) {
    throw new TypeError("Expected Host event plan digest does not match its events");
  }
  if (
    transcript.events.length !== expectedEventPlan.events.length ||
    transcript.events.some((event, index) => {
      const expected = expectedEventPlan.events[index];
      return expected === undefined ||
        !step16EventMatchesPlanV1(event, expected);
    })
  ) {
    throw new TypeError(
      "Host transcript does not exactly match the versioned expected event plan",
    );
  }

  return Step16ReceiptInventoryV1Schema.parse({
    schemaVersion: 1,
    profile: "step16_receipt_inventory_v1",
    authority: "structural_receipt_inventory_not_gold_eligibility",
    expectedEventPlanDigest: derivedPlanDigest,
    ...input,
    transcript,
  });
}
