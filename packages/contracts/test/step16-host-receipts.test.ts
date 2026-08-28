import { describe, expect, it } from "vitest";

import {
  createStep16ReceiptInventoryV1,
  deriveStep16ExpectedHostEventPlanDigestV1,
  Step16ExpectedHostEventPlanV1Schema,
  Step16ProviderReceiptBindingV1Schema,
  Step16RealHostActionReceiptV1Schema,
  Step16RealHostEventV1Schema,
  Step16RealHostTranscriptReceiptV1Schema,
  Step16RealHostToolCallReceiptV1Schema,
  Step16ReceiptInventoryV1Schema,
} from "../src/step16-host-receipts.js";

const digest = (value: number): string =>
  `sha256:${value.toString(16).padStart(64, "0")}`;

const eventDefinitions = [
  { kind: "mcp_tool_call", tool: "get_repo_pulse" },
  { kind: "mcp_tool_call", tool: "refresh_index" },
  { kind: "mcp_tool_call", tool: "build_task_brief" },
  { kind: "mcp_tool_call", tool: "update_task" },
  { kind: "mcp_tool_call", tool: "get_task_brief" },
  { kind: "mcp_tool_call", tool: "update_task" },
  {
    kind: "host_action",
    action: "source_mutation",
    mechanism: "file_change",
  },
  { kind: "mcp_tool_call", tool: "refresh_index" },
  { kind: "mcp_tool_call", tool: "check_change" },
  { kind: "mcp_tool_call", tool: "get_evidence" },
  {
    kind: "host_action",
    action: "verification",
    mechanism: "command_execution",
  },
  {
    kind: "host_action",
    action: "verification",
    mechanism: "command_execution",
  },
  { kind: "mcp_tool_call", tool: "open_workbench" },
  { kind: "mcp_tool_call", tool: "record_verification" },
] as const;

const strongTools = new Set([
  "refresh_index",
  "build_task_brief",
  "update_task",
  "check_change",
  "record_verification",
]);

const sessionIdDigest = digest(1);
const providerIdentityDigest = digest(2);

function transcript(): any {
  return {
    schemaVersion: 1,
    host: "codex",
    sessionIdDigest,
    events: eventDefinitions.map((definition, index) =>
      definition.kind === "mcp_tool_call"
        ? {
            kind: definition.kind,
            server: "understand-code",
            tool: definition.tool,
            ordinal: index + 1,
            callIdDigest: digest(10 + index),
            argumentsDigest: digest(40 + index),
            resultDigest: digest(70 + index),
            success: true,
          }
        : {
            kind: definition.kind,
            action: definition.action,
            mechanism: definition.mechanism,
            ordinal: index + 1,
            actionIdDigest: digest(10 + index),
            inputDigest: digest(40 + index),
            resultDigest: digest(70 + index),
            success: true,
          },
    ),
  };
}

async function expectedEventPlan(): Promise<any> {
  const events = eventDefinitions.map((definition, index) =>
      definition.kind === "mcp_tool_call"
        ? {
            kind: definition.kind,
            ordinal: index + 1,
            server: "understand-code",
            tool: definition.tool,
          }
        : {
            kind: definition.kind,
            ordinal: index + 1,
            action: definition.action,
            mechanism: definition.mechanism,
            inputDigest: digest(40 + index),
          },
    );
  return {
    expectedEventPlanDigest:
      await deriveStep16ExpectedHostEventPlanDigestV1(events),
    events,
  };
}

function providerBinding(
  receiptBundleDigest: string,
  callIdDigest: string,
  index = 0,
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    profile: "step16_provider_receipt_binding_v1",
    host: "codex",
    sessionIdDigest,
    callIdDigest,
    providerIdentityDigest,
    receiptLedger: {
      authority: "root_owned_private_provider_receipt_ledger",
      locatorPolicy: "fixed_locator_component_nofollow",
      receiptBundleDigest,
    },
    providerOperation: {
      operation: "compare_commit",
      operationNonce: index.toString(16).padStart(32, "0"),
      requestDigest: digest(200 + index),
      sessionBindingDigest: digest(201),
      principalAttestationDigest: digest(202),
      authorityGrantContentDigest: digest(203),
      responseResolution: "committed",
    },
    componentDigests: {
      strongMutationRequest: digest(300 + index),
      strongMutationResponse: digest(400 + index),
      principalAttestation: digest(206),
      authorityGrantEnvelope: digest(207),
      authorityGrantSignature: digest(208),
      responseSignature: digest(209),
      principalAttestationSignature: digest(210),
    },
    privateBundleVerification: {
      status: "verified",
      verifierProfile: "provider_runtime_ipc_full_private_bundle_verifier_v1",
      verifiedBindings: [
        "request_digest",
        "session_binding",
        "authority_grant_signature",
        "response_signature",
        "principal_attestation_signature",
      ],
    },
  };
}

function validInput(): any {
  const hostTranscript = transcript();
  const mcpEvents = hostTranscript.events.filter(
    (event: any) => event.kind === "mcp_tool_call",
  );
  const strongCalls = mcpEvents.filter((event: any) =>
    strongTools.has(event.tool),
  );
  const groups = strongCalls.map((call: any, index: number) => ({
    callIdDigest: call.callIdDigest,
    receiptBundleDigests: [digest(100 + index)],
  }));
  return {
    taskSlotId: "alpha-a-slot-01",
    taskDefinitionDigest: digest(4),
    executionIdentity: {
      taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      revision: 7,
      providerIdentityDigest,
    },
    transcript: hostTranscript,
    requiredStages: {
      repoPulse: {
        tool: "get_repo_pulse",
        callIdDigest: hostTranscript.events[0].callIdDigest,
      },
      refreshBaseline: {
        tool: "refresh_index",
        callIdDigest: hostTranscript.events[1].callIdDigest,
      },
      taskBrief: {
        tool: "build_task_brief",
        callIdDigest: hostTranscript.events[2].callIdDigest,
      },
      taskUpdate: {
        tool: "update_task",
        callIdDigest: hostTranscript.events[5].callIdDigest,
      },
      refreshChanged: {
        tool: "refresh_index",
        callIdDigest: hostTranscript.events[7].callIdDigest,
      },
      changeCheck: {
        tool: "check_change",
        callIdDigest: hostTranscript.events[8].callIdDigest,
      },
      verification: {
        tool: "record_verification",
        callIdDigest: hostTranscript.events[13].callIdDigest,
      },
    },
    requiredHostActions: {
      sourceMutation: {
        action: "source_mutation",
        actionIdDigest: hostTranscript.events[6].actionIdDigest,
      },
      verification: [10, 11].map((index) => ({
        action: "verification",
        actionIdDigest: hostTranscript.events[index].actionIdDigest,
      })),
    },
    strongCallProviderReceipts: groups,
    providerBindings: groups.map((group: any, index: number) =>
      providerBinding(group.receiptBundleDigests[0], group.callIdDigest, index),
    ),
  };
}

async function validInventory(): Promise<any> {
  return createStep16ReceiptInventoryV1(validInput(), await expectedEventPlan());
}

function reindexEvents(value: any): void {
  value.transcript.events.forEach((event: any, index: number) => {
    event.ordinal = index + 1;
  });
}

describe("Step 16 real Host receipt contracts", () => {
  it("derives the same expected-plan digest as the Node Host adapter", async () => {
    const plan = await expectedEventPlan();
    const { deriveStep16ExpectedHostEventPlanDigestV1: deriveHostDigest } =
      await import("../../host-adapters/src/real-host-receipts.js");
    expect(deriveHostDigest(plan.events)).toBe(plan.expectedEventPlanDigest);
  });

  it("accepts one globally ordered union of MCP calls and Host actions", () => {
    const receipt = transcript();
    expect(receipt.events).toHaveLength(14);
    expect(Step16RealHostTranscriptReceiptV1Schema.safeParse(receipt).success)
      .toBe(true);
    expect(
      Step16RealHostToolCallReceiptV1Schema.safeParse(receipt.events[0]).success,
    ).toBe(true);
    expect(
      Step16RealHostActionReceiptV1Schema.safeParse(receipt.events[6]).success,
    ).toBe(true);
    for (const event of receipt.events) {
      expect(Step16RealHostEventV1Schema.safeParse(event).success).toBe(true);
    }
  });

  it("keeps MCP projections path-free and fail-closes Tool errors", () => {
    const call = transcript().events[0];
    for (const forbiddenField of [
      "rawTranscript",
      "toolInput",
      "toolResult",
      "absolutePath",
    ]) {
      expect(
        Step16RealHostToolCallReceiptV1Schema.safeParse({
          ...call,
          [forbiddenField]: "/private/repository/secret.ts",
        }).success,
      ).toBe(false);
    }
    expect(
      Step16RealHostToolCallReceiptV1Schema.safeParse({
        ...call,
        server: "another-server",
      }).success,
    ).toBe(false);
    expect(
      Step16RealHostToolCallReceiptV1Schema.safeParse({
        ...call,
        success: false,
      }).success,
    ).toBe(false);
  });

  it("keeps Host actions free of commands, paths, content, and tool names", () => {
    const action = transcript().events[6];
    for (const [field, value] of [
      ["rawCommand", "git status"],
      ["command", "pnpm test"],
      ["absolutePath", "/private/repository/secret.ts"],
      ["path", "src/private.ts"],
      ["content", "private source"],
      ["tool", "shell"],
    ]) {
      expect(
        Step16RealHostActionReceiptV1Schema.safeParse({
          ...action,
          [field]: value,
        }).success,
      ).toBe(false);
    }
    expect(
      Step16RealHostActionReceiptV1Schema.safeParse({
        ...action,
        action: "unknown_action",
      }).success,
    ).toBe(false);
    expect(
      Step16RealHostActionReceiptV1Schema.safeParse({
        ...action,
        mechanism: "shell_tool",
      }).success,
    ).toBe(false);
    expect(
      Step16RealHostActionReceiptV1Schema.safeParse({
        ...action,
        mechanism: "command_execution",
      }).success,
    ).toBe(false);
    expect(
      Step16RealHostActionReceiptV1Schema.safeParse({
        ...action,
        success: false,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate IDs across event kinds and non-contiguous ordinals", () => {
    const duplicate = transcript();
    duplicate.events[6].actionIdDigest = duplicate.events[0].callIdDigest;
    expect(Step16RealHostTranscriptReceiptV1Schema.safeParse(duplicate).success)
      .toBe(false);

    const unordered = transcript();
    unordered.events[6].ordinal = 8;
    expect(Step16RealHostTranscriptReceiptV1Schema.safeParse(unordered).success)
      .toBe(false);
  });

  it("binds only verified private Provider bundle projections", () => {
    const binding = providerBinding(digest(100), digest(11));
    expect(Step16ProviderReceiptBindingV1Schema.safeParse(binding).success)
      .toBe(true);
    expect(
      Step16ProviderReceiptBindingV1Schema.safeParse({
        ...binding,
        providerRevision: 7,
      }).success,
    ).toBe(false);
    expect(
      Step16ProviderReceiptBindingV1Schema.safeParse({
        ...binding,
        rawRequest: { path: "/private/repository" },
      }).success,
    ).toBe(false);
    expect(
      Step16ProviderReceiptBindingV1Schema.safeParse({
        ...binding,
        providerOperation: {
          ...(binding.providerOperation as object),
          responseResolution: "stale",
        },
      }).success,
    ).toBe(false);
  });

  it("builds a structural inventory without asserting Gold eligibility", async () => {
    const plan = await expectedEventPlan();
    const inventory = await createStep16ReceiptInventoryV1(validInput(), plan);
    expect(inventory).toMatchObject({
      schemaVersion: 1,
      profile: "step16_receipt_inventory_v1",
      authority: "structural_receipt_inventory_not_gold_eligibility",
      expectedEventPlanDigest: plan.expectedEventPlanDigest,
    });
    expect(inventory.transcript.events).toHaveLength(14);
    expect(inventory.requiredHostActions.verification).toHaveLength(2);
    expect(inventory.strongCallProviderReceipts).toHaveLength(7);
    expect(inventory.providerBindings).toHaveLength(7);
    expect(Step16ReceiptInventoryV1Schema.safeParse(inventory).success).toBe(true);
  });

  it("compares every global event with an external expected plan", async () => {
    const plan = await expectedEventPlan();
    const missingAction = validInput();
    missingAction.transcript.events.splice(10, 1);
    reindexEvents(missingAction);
    await expect(
      createStep16ReceiptInventoryV1(missingAction, plan),
    ).rejects.toThrow("does not exactly match");

    const extraAction = validInput();
    extraAction.transcript.events.push({
      kind: "host_action",
      action: "verification",
      mechanism: "command_execution",
      ordinal: 15,
      actionIdDigest: digest(250),
      inputDigest: digest(251),
      resultDigest: digest(252),
      success: true,
    });
    await expect(
      createStep16ReceiptInventoryV1(extraAction, plan),
    ).rejects.toThrow("does not exactly match");

    const wrongMechanism = structuredClone(plan);
    wrongMechanism.events[6].mechanism = "command_execution";
    expect(Step16ExpectedHostEventPlanV1Schema.safeParse(wrongMechanism).success)
      .toBe(false);
    await expect(
      createStep16ReceiptInventoryV1(validInput(), wrongMechanism),
    ).rejects.toThrow();

    const wrongActionInput = structuredClone(plan);
    wrongActionInput.events[6].inputDigest = digest(249);
    wrongActionInput.expectedEventPlanDigest =
      await deriveStep16ExpectedHostEventPlanDigestV1(wrongActionInput.events);
    await expect(
      createStep16ReceiptInventoryV1(validInput(), wrongActionInput),
    ).rejects.toThrow("does not exactly match");

    await expect(
      createStep16ReceiptInventoryV1(validInput(), {
        ...plan,
        expectedEventPlanDigest: digest(249),
      }),
    ).rejects.toThrow("digest does not match");
  });

  it("keeps the external expected event plan strict and ordered", async () => {
    const plan = await expectedEventPlan();
    plan.events[6].rawCommand = "apply private patch";
    expect(Step16ExpectedHostEventPlanV1Schema.safeParse(plan).success)
      .toBe(false);

    const unordered = await expectedEventPlan();
    unordered.events[6].ordinal = 8;
    expect(Step16ExpectedHostEventPlanV1Schema.safeParse(unordered).success)
      .toBe(false);
  });

  it.each([
    ["missing Provider call group", (value: any) => {
      value.strongCallProviderReceipts.pop();
    }],
    ["Host action in Provider coverage", (value: any) => {
      value.strongCallProviderReceipts.push({
        callIdDigest: value.transcript.events[6].actionIdDigest,
        receiptBundleDigests: [digest(240)],
      });
    }],
    ["missing Provider binding", (value: any) => value.providerBindings.pop()],
    ["extra Provider binding", (value: any) => {
      value.providerBindings.push(
        providerBinding(digest(240), value.transcript.events[1].callIdDigest),
      );
    }],
    ["unpaired Provider binding", (value: any) => {
      value.providerBindings[0].callIdDigest = value.transcript.events[3].callIdDigest;
    }],
    ["wrong Provider order", (value: any) => {
      [value.providerBindings[0], value.providerBindings[1]] =
        [value.providerBindings[1], value.providerBindings[0]];
    }],
    ["duplicate Provider bundle", (value: any) => {
      const duplicate = value.strongCallProviderReceipts[0].receiptBundleDigests[0];
      value.strongCallProviderReceipts[1].receiptBundleDigests[0] = duplicate;
      value.providerBindings[1].receiptLedger.receiptBundleDigest = duplicate;
    }],
    ["wrong Provider identity", (value: any) => {
      value.providerBindings[0].host = "claude";
    }],
    ["mismatched required MCP stage", (value: any) => {
      value.requiredStages.taskBrief.callIdDigest =
        value.transcript.events[4].callIdDigest;
    }],
    ["mismatched source mutation", (value: any) => {
      value.requiredHostActions.sourceMutation.actionIdDigest =
        value.transcript.events[10].actionIdDigest;
    }],
    ["source mutation before plan confirmation", (value: any) => {
      const [sourceMutation] = value.transcript.events.splice(6, 1);
      value.transcript.events.splice(4, 0, sourceMutation);
      reindexEvents(value);
    }],
    ["source mutation after changed refresh", (value: any) => {
      const [sourceMutation] = value.transcript.events.splice(6, 1);
      value.transcript.events.splice(8, 0, sourceMutation);
      reindexEvents(value);
    }],
    ["missing verification Host action", (value: any) => {
      value.requiredHostActions.verification = [];
    }],
    ["duplicate verification Host action", (value: any) => {
      value.requiredHostActions.verification.push(
        value.requiredHostActions.verification[0],
      );
    }],
    ["verification action before Check", (value: any) => {
      const [verification] = value.transcript.events.splice(10, 1);
      value.transcript.events.splice(8, 0, verification);
      reindexEvents(value);
    }],
    ["verification action after record_verification", (value: any) => {
      const [verification] = value.transcript.events.splice(10, 1);
      value.transcript.events.push(verification);
      reindexEvents(value);
    }],
  ])("rejects %s", async (_label, mutate) => {
    const inventory = await validInventory();
    mutate(inventory);
    expect(Step16ReceiptInventoryV1Schema.safeParse(inventory).success).toBe(false);
  });
});
