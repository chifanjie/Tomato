import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  BuildTaskBriefOutputV1Schema,
  CheckChangeOutputV1Schema,
  GetEvidenceOutputV1Schema,
  GetRepoPulsePublicMetaV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefOutputV1Schema,
  McpCancelledNotificationV1Schema,
  McpProgressNotificationV1Schema,
  McpProgressRequestMetaV1Schema,
  McpToolErrorResultV1Schema,
  OpenWorkbenchInputV1Schema,
  OpenWorkbenchOutputV1Schema,
  P0_MCP_TOOL_CONTRACTS_V1,
  P0_MCP_TOOL_NAMES_V1,
  PageInfoV1Schema,
  PROVIDER_CAPABILITY_FAILURE_REASONS_V1,
  ProviderUnavailableToolErrorV1Schema,
  RecordVerificationOutputV1Schema,
  RefreshIndexCancellationV1Schema,
  RefreshIndexInputV1Schema,
  RefreshIndexOutputV1Schema,
  RefreshIndexProgressV1Schema,
  SearchContextOutputV1Schema,
  ToolErrorEnvelopeV1Schema,
  ToolSuccessMetaV1Schema,
  TraceImpactOutputV1Schema,
  UpdateTaskOutputV1Schema,
  WorkspaceBindingReasonV1Schema,
  createProviderUnavailableToolErrorV1,
} from "../src/mcp.js";
import {
  ProviderUnavailableToolErrorV1Schema as DirectProviderUnavailableToolErrorV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-error";
import { parseTrustedTaskArtifactBundleV1 } from "../src/invariants.js";

const TASK_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const SNAPSHOT_ID = "snapshot-1";
const DIGEST = `sha256:${"a".repeat(64)}`;
const OTHER_DIGEST = `sha256:${"b".repeat(64)}`;
const HEAD_COMMIT = "c".repeat(40);

function referenceFixture(fileName: string): unknown {
  return JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../fixtures/v1/reference/${fileName}`, import.meta.url),
      ),
      "utf8",
    ),
  ) as unknown;
}

function surfaceFixture(fileName: string): unknown {
  return JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../fixtures/v1/surface/${fileName}`, import.meta.url),
      ),
      "utf8",
    ),
  ) as unknown;
}

function referencePayload<T>(fileName: string): T {
  return (referenceFixture(fileName) as { payload: T }).payload;
}

interface ProviderErrorFixtureManifest {
  schemaVersion: 1;
  cases: Array<{ caseId: string; value: unknown }>;
}

function providerErrorFixture(
  fixtureKind: "reference" | "invalid",
): ProviderErrorFixtureManifest {
  return JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          `../../durable-object-provider-contracts/fixtures/v1/${fixtureKind}/provider-unavailable-tool-errors.json`,
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  ) as ProviderErrorFixtureManifest;
}

function digestCanonicalJson(canonicalJson: string): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJson, "utf8")
    .digest("hex")}`;
}

const successMeta = {
  repositoryId: "repo-1",
  worktreeId: "worktree-1",
  sourceSnapshotId: SNAPSHOT_ID,
  headCommit: HEAD_COMMIT,
  worktreeFingerprint: DIGEST,
  freshness: "fresh",
  durationMs: 12.5,
  cacheHit: false,
  truncated: false,
  truncatedCategories: [],
} as const;

const repoPulsePublicMeta = {
  durationMs: 12.5,
  cacheHit: false,
} as const;
const legacyRepoPulseSurface = surfaceFixture(
  "legacy-repo-pulse-redacted.json",
);

const referenceTask = referencePayload<{
  taskId: string;
  revision: number;
  repositoryId: string;
  worktreeId: string;
  latestSnapshotId: string;
}>("task.json");
const referenceBrief = referencePayload<Record<string, unknown>>(
  "task-brief.json",
);
const referenceEvidence = referencePayload<{ evidence: unknown[] }>(
  "evidence.json",
);
const referenceImpact = referencePayload<{ paths: unknown[] }>("impact.json");
const referenceChangeCheck = referencePayload<{
  taskId: string;
  taskRevision: number;
  actualSnapshotId: string;
}>("change-check.json");
const referenceVerification = referencePayload<{
  records: Array<{
    taskId: string;
    snapshotId: string;
    [key: string]: unknown;
  }>;
}>("verification.json");

const referenceSuccessMeta = {
  ...successMeta,
  repositoryId: referenceTask.repositoryId,
  worktreeId: referenceTask.worktreeId,
  sourceSnapshotId: referenceTask.latestSnapshotId,
} as const;

function mutationResult(taskId: string, revision: number) {
  return {
    taskId,
    revision,
    eventId: `event:output:${revision}`,
    artifactIds: ["artifact:task-manifest"],
    idempotentReplay: false,
  };
}

function successOutput(result: unknown) {
  return {
    content: [{ type: "text", text: "The operation completed." }],
    structuredContent: {
      schemaVersion: 1,
      meta: referenceSuccessMeta,
      result,
    },
  };
}

function pagedSuccessOutput(result: unknown, returned: number) {
  return {
    content: [{ type: "text", text: "The requested page is ready." }],
    structuredContent: {
      schemaVersion: 1,
      meta: referenceSuccessMeta,
      page: {
        pageSize: 20,
        returned,
        hasMore: false,
      },
      result,
    },
  };
}

describe("P0 MCP tool inventory", () => {
  it("freezes exactly the eleven approved P0 tools", () => {
    expect(P0_MCP_TOOL_NAMES_V1).toEqual([
      "get_repo_pulse",
      "build_task_brief",
      "get_task_brief",
      "update_task",
      "search_context",
      "get_evidence",
      "trace_impact",
      "check_change",
      "record_verification",
      "open_workbench",
      "refresh_index",
    ]);
    expect(Object.keys(P0_MCP_TOOL_CONTRACTS_V1)).toEqual(
      P0_MCP_TOOL_NAMES_V1,
    );
    expect(P0_MCP_TOOL_NAMES_V1).toHaveLength(11);
    expect(P0_MCP_TOOL_NAMES_V1).not.toContain("cancel_refresh_index");
  });

  it("accepts a valid request for every tool and rejects unknown arguments", () => {
    const inputs = {
      get_repo_pulse: {},
      build_task_brief: {
        task: "Add a stable MCP contract",
        expectedRevision: 0,
        idempotencyKey: "create-1",
        actor: "codex",
        scope: ["packages/contracts/src"],
        tokenBudget: 4_000,
        maxCandidates: 20,
        maxImpactDepth: 5,
      },
      get_task_brief: {
        taskId: TASK_ID,
        section: "reading_path",
        pageSize: 25,
      },
      update_task: {
        taskId: TASK_ID,
        action: {
          type: "block_task",
          reasonCode: "awaiting_owner",
          message: "Waiting for repository owner confirmation.",
        },
        expectedRevision: 2,
        idempotencyKey: "update-1",
        actor: "codex",
      },
      search_context: {
        query: "workspace binding",
        taskId: TASK_ID,
        scopes: ["file", "symbol"],
        pageSize: 20,
      },
      get_evidence: {
        taskId: TASK_ID,
        evidenceIds: ["evidence-1", "evidence-2"],
        maxExcerptChars: 1_000,
      },
      trace_impact: {
        taskId: TASK_ID,
        sourceNodeIds: ["symbol:handler"],
        direction: "downstream",
        maxDepth: 4,
      },
      check_change: {
        taskId: TASK_ID,
        actualSnapshotId: referenceTask.latestSnapshotId,
        includeWorktree: true,
        expectedRevision: 3,
        idempotencyKey: "check-1",
        actor: "codex",
      },
      record_verification: {
        taskId: TASK_ID,
        record: {
          verificationPlanEntryId: "verification-plan-1",
          kind: "test",
          status: "passed",
          command: "pnpm test",
          exitCode: 0,
          durationMs: 1_000,
          outputDigest: DIGEST,
          summary: "Contract tests passed.",
          claimIds: ["claim-1"],
          snapshotId: SNAPSHOT_ID,
        },
        expectedRevision: 4,
        idempotencyKey: "verification-1",
        actor: "codex",
      },
      open_workbench: {
        route: {
          view: "tasks",
          taskId: TASK_ID,
          section: "change-check",
          findingId: "finding-1",
        },
        openBrowser: true,
      },
      refresh_index: {
        mode: "incremental",
        expectedSourceSnapshotId: SNAPSHOT_ID,
        idempotencyKey: "refresh-1",
        actor: "codex",
      },
    } as const;

    for (const toolName of P0_MCP_TOOL_NAMES_V1) {
      const contract = P0_MCP_TOOL_CONTRACTS_V1[toolName];
      expect(
        contract.input.safeParse(inputs[toolName]).success,
        `${toolName} should accept its valid fixture`,
      ).toBe(true);
      expect(
        contract.input.safeParse({
          ...inputs[toolName],
          arbitraryPath: "/outside/repository",
        }).success,
        `${toolName} should reject undeclared arguments`,
      ).toBe(false);
    }
  });
});

describe("common MCP response contracts", () => {
  it("uses the trusted Task Bundle parser for the same handoff artifact as Core and Dashboard", () => {
    const bundle = referenceFixture("task-bundle.json");
    const trusted = parseTrustedTaskArtifactBundleV1(
      bundle,
      digestCanonicalJson,
    );
    expect(trusted.manifest.taskId).toBe(referenceTask.taskId);

    const tampered = structuredClone(trusted);
    tampered.events[1]!.actor = "tampered-actor";
    tampered.idempotencyRecords[1]!.actor = "tampered-actor";
    expect(() =>
      parseTrustedTaskArtifactBundleV1(tampered, digestCanonicalJson),
    ).toThrow();
  });

  it("parses the strict legacy-redacted Repo Pulse Surface", () => {
    expect(
      GetRepoPulseOutputV1Schema.safeParse({
        content: [{ type: "text", text: "Repository pulse is fresh." }],
        structuredContent: {
          schemaVersion: 1,
          meta: repoPulsePublicMeta,
          result: { pulse: legacyRepoPulseSurface },
        },
      }).success,
    ).toBe(true);
  });

  it("requires repository identity, freshness, timing, cache, and truncation metadata", () => {
    expect(ToolSuccessMetaV1Schema.safeParse(successMeta).success).toBe(true);
    expect(
      ToolSuccessMetaV1Schema.safeParse({
        ...successMeta,
        truncated: true,
      }).success,
    ).toBe(false);
    expect(
      ToolSuccessMetaV1Schema.safeParse({
        ...successMeta,
        durationMs: undefined,
      }).success,
    ).toBe(false);
  });

  it("uses Pulse-specific public metadata with no legacy identity or digest fields", () => {
    expect(
      GetRepoPulsePublicMetaV1Schema.safeParse(repoPulsePublicMeta).success,
    ).toBe(true);
    for (const leaked of [
      { repositoryId: "repository:legacy" },
      { worktreeId: "worktree:legacy" },
      { sourceSnapshotId: "snapshot:legacy" },
      { headCommit: HEAD_COMMIT },
      { worktreeFingerprint: DIGEST },
    ]) {
      expect(
        GetRepoPulsePublicMetaV1Schema.safeParse({
          ...repoPulsePublicMeta,
          ...leaked,
        }).success,
      ).toBe(false);
    }
  });

  it("keeps pagination continuation state internally consistent", () => {
    expect(
      PageInfoV1Schema.safeParse({
        pageSize: 20,
        returned: 20,
        nextCursor: "opaque-next",
        hasMore: true,
      }).success,
    ).toBe(true);
    expect(
      PageInfoV1Schema.safeParse({
        pageSize: 20,
        returned: 20,
        hasMore: true,
      }).success,
    ).toBe(false);
    expect(
      PageInfoV1Schema.safeParse({
        pageSize: 20,
        returned: 21,
        hasMore: false,
      }).success,
    ).toBe(false);
  });

  it("parses a complete success envelope and rejects undeclared structured fields", () => {
    const result = {
      content: [{ type: "text", text: "Repository pulse is fresh." }],
      structuredContent: {
        schemaVersion: 1,
        meta: repoPulsePublicMeta,
        result: {
          pulse: legacyRepoPulseSurface,
        },
      },
    };

    expect(GetRepoPulseOutputV1Schema.safeParse(result).success).toBe(true);
    expect(
      GetRepoPulseOutputV1Schema.safeParse({
        ...result,
        structuredContent: {
          ...result.structuredContent,
          debugRoot: "/private/repository",
        },
      }).success,
    ).toBe(false);
    expect(
      GetRepoPulseOutputV1Schema.safeParse({
        ...result,
        structuredContent: {
          ...result.structuredContent,
          result: {
            pulse: {
              ...(result.structuredContent.result.pulse as Record<string, unknown>),
              evaluatedSnapshotId: "snapshot:legacy",
            },
          },
        },
      }).success,
    ).toBe(false);
    expect(
      GetRepoPulseOutputV1Schema.safeParse({
        ...result,
        structuredContent: {
          ...result.structuredContent,
          meta: {
            ...repoPulsePublicMeta,
            sourceSnapshotId: "snapshot:legacy",
          },
        },
      }).success,
    ).toBe(false);
    const rawLegacyPulse = referencePayload<Record<string, unknown>>(
      "repo-pulse.json",
    );
    expect(
      GetRepoPulseOutputV1Schema.safeParse({
        ...result,
        structuredContent: {
          ...result.structuredContent,
          result: { pulse: rawLegacyPulse },
        },
      }).success,
    ).toBe(false);
  });

  it("binds paged counts and Task Brief item kinds to the requested section", () => {
    const taskArtifact = referenceFixture("task.json") as {
      payload: {
        repositoryId: string;
        worktreeId: string;
        latestSnapshotId: string;
      };
    };
    const base = {
      content: [{ type: "text", text: "Task summary." }],
      structuredContent: {
        schemaVersion: 1,
        meta: {
          ...successMeta,
          repositoryId: taskArtifact.payload.repositoryId,
          worktreeId: taskArtifact.payload.worktreeId,
          sourceSnapshotId: taskArtifact.payload.latestSnapshotId,
        },
        page: {
          pageSize: 20,
          returned: 1,
          hasMore: false,
        },
        result: {
          task: taskArtifact.payload,
          section: "summary",
          items: [
            {
              kind: "summary",
              originalIntent: "Keep evidence stable.",
              goalClaimId: "claim:goal",
              acceptanceClaimCount: 1,
              plannedChangeCount: 1,
            },
          ],
        },
      },
    } as const;
    expect(GetTaskBriefOutputV1Schema.safeParse(base).success).toBe(true);
    expect(
      GetTaskBriefOutputV1Schema.safeParse({
        ...base,
        structuredContent: {
          ...base.structuredContent,
          page: { ...base.structuredContent.page, returned: 0 },
        },
      }).success,
    ).toBe(false);
    expect(
      GetTaskBriefOutputV1Schema.safeParse({
        ...base,
        structuredContent: {
          ...base.structuredContent,
          result: {
            ...base.structuredContent.result,
            section: "reading_path",
          },
        },
      }).success,
    ).toBe(false);
  });
});

describe("task workflow MCP success outputs", () => {
  it("binds build_task_brief Task and mutation identity to MCP meta", () => {
    const result = {
      task: referenceTask,
      brief: referenceBrief,
      mutation: mutationResult(referenceTask.taskId, referenceTask.revision),
      claimIds: ["claim:goal"],
      evidenceIds: ["evidence:goal"],
    };
    const output = successOutput(result);

    expect(BuildTaskBriefOutputV1Schema.safeParse(output).success).toBe(true);
    expect(
      BuildTaskBriefOutputV1Schema.safeParse({
        ...output,
        structuredContent: {
          ...output.structuredContent,
          result: {
            ...result,
            mutation: {
              ...result.mutation,
              revision: referenceTask.revision + 1,
            },
          },
        },
      }).success,
    ).toBe(false);
  });

  it("binds update_task Task and mutation identity to MCP meta", () => {
    const result = {
      task: referenceTask,
      mutation: mutationResult(referenceTask.taskId, referenceTask.revision),
    };
    const output = successOutput(result);

    expect(UpdateTaskOutputV1Schema.safeParse(output).success).toBe(true);
    expect(
      UpdateTaskOutputV1Schema.safeParse({
        ...output,
        structuredContent: {
          ...output.structuredContent,
          result: {
            ...result,
            task: {
              ...referenceTask,
              worktreeId: "worktree:other",
            },
          },
        },
      }).success,
    ).toBe(false);
  });

  it("keeps search_context result counts aligned with pagination", () => {
    const result = {
      results: [
        {
          id: "search:symbol:task-handler",
          kind: "symbol",
          title: "Task handler",
          summary: "Applies a typed Task mutation.",
          score: 0.95,
          reasons: ["Exact symbol match."],
          evidenceIds: ["evidence:source"],
          symbolId: "symbol:task-handler",
          filePath: "src/task.ts",
        },
      ],
    };
    const output = pagedSuccessOutput(result, 1);

    expect(SearchContextOutputV1Schema.safeParse(output).success).toBe(true);
    expect(
      SearchContextOutputV1Schema.safeParse({
        ...output,
        structuredContent: {
          ...output.structuredContent,
          page: {
            ...output.structuredContent.page,
            returned: 0,
          },
        },
      }).success,
    ).toBe(false);
  });

  it("keeps get_evidence returned counts aligned with evidence and missing IDs", () => {
    const result = {
      evidence: [referenceEvidence.evidence[0]],
      missingEvidenceIds: ["evidence:missing"],
    };
    const output = pagedSuccessOutput(result, 2);

    expect(GetEvidenceOutputV1Schema.safeParse(output).success).toBe(true);
    expect(
      GetEvidenceOutputV1Schema.safeParse({
        ...output,
        structuredContent: {
          ...output.structuredContent,
          page: {
            ...output.structuredContent.page,
            returned: 1,
          },
        },
      }).success,
    ).toBe(false);
  });

  it("keeps trace_impact returned counts aligned with paths and unresolved nodes", () => {
    const result = {
      paths: [referenceImpact.paths[0]],
      unresolvedNodeIds: ["symbol:unresolved"],
    };
    const output = pagedSuccessOutput(result, 2);

    expect(TraceImpactOutputV1Schema.safeParse(output).success).toBe(true);
    expect(
      TraceImpactOutputV1Schema.safeParse({
        ...output,
        structuredContent: {
          ...output.structuredContent,
          page: {
            ...output.structuredContent.page,
            returned: 1,
          },
        },
      }).success,
    ).toBe(false);
  });

  it("binds check_change Check, mutation, and Snapshot identity", () => {
    const result = {
      changeCheck: referenceChangeCheck,
      changeCheckClassification: {
        profile: "legacy_summary",
        emptyFindingsAreClean: false,
      },
      mutation: mutationResult(
        referenceChangeCheck.taskId,
        referenceChangeCheck.taskRevision,
      ),
    };
    const output = successOutput(result);

    expect(CheckChangeOutputV1Schema.safeParse(output).success).toBe(true);
    const { changeCheckClassification: _classification, ...withoutClassification } =
      result;
    expect(
      CheckChangeOutputV1Schema.safeParse(successOutput(withoutClassification))
        .success,
    ).toBe(false);
    expect(
      CheckChangeOutputV1Schema.safeParse({
        ...output,
        structuredContent: {
          ...output.structuredContent,
          result: {
            ...result,
            changeCheck: {
              ...referenceChangeCheck,
              actualSnapshotId: "snapshot:other",
            },
          },
        },
      }).success,
    ).toBe(false);
  });

  it("binds record_verification record identity to mutation and MCP meta", () => {
    const verification = referenceVerification.records[0];
    const result = {
      verification,
      mutation: mutationResult(referenceTask.taskId, referenceTask.revision),
    };
    const output = successOutput(result);

    expect(RecordVerificationOutputV1Schema.safeParse(output).success).toBe(
      true,
    );
    expect(
      RecordVerificationOutputV1Schema.safeParse({
        ...output,
        structuredContent: {
          ...output.structuredContent,
          meta: {
            ...output.structuredContent.meta,
            sourceSnapshotId: "snapshot:other",
          },
        },
      }).success,
    ).toBe(false);
  });

  it("binds refresh_index completion identity and chronology to MCP meta", () => {
    const result = {
      operation: {
        operationId: "operation:refresh",
        mode: "incremental",
        status: "completed",
        sourceSnapshotId: "snapshot:baseline",
        finalSnapshotId: referenceTask.latestSnapshotId,
        startedAt: "2026-07-28T08:00:00Z",
        completedAt: "2026-07-28T08:01:00Z",
        previousSnapshotPreservedUntilCommit: true,
        cancellation: {
          mechanism: "mcp_request_cancellation",
          notificationMethod: "notifications/cancelled",
          effect: "cooperative_stop_preserve_last_snapshot",
        },
      },
    };
    const output = successOutput(result);

    expect(RefreshIndexOutputV1Schema.safeParse(output).success).toBe(true);
    expect(
      RefreshIndexOutputV1Schema.safeParse({
        ...output,
        structuredContent: {
          ...output.structuredContent,
          result: {
            operation: {
              ...result.operation,
              finalSnapshotId: "snapshot:other",
            },
          },
        },
      }).success,
    ).toBe(false);
  });
});

describe("stable tool errors", () => {
  it("uses the Provider package as the only six-reason failure authority", () => {
    expect(ProviderUnavailableToolErrorV1Schema).toBe(
      DirectProviderUnavailableToolErrorV1Schema,
    );
    expect(PROVIDER_CAPABILITY_FAILURE_REASONS_V1).toEqual([
      "unavailable",
      "unsupported_filesystem_profile",
      "attestation_invalid",
      "revoked",
      "migration_required",
      "initialization_not_terminalized",
    ]);

    const referenceCases = providerErrorFixture("reference").cases;
    expect(referenceCases).toHaveLength(6);
    expect(
      referenceCases.map(
        ({ value }) =>
          (value as { details: { reason: string } }).details.reason,
      ),
    ).toEqual(PROVIDER_CAPABILITY_FAILURE_REASONS_V1);

    for (const [index, fixtureCase] of referenceCases.entries()) {
      const reason = PROVIDER_CAPABILITY_FAILURE_REASONS_V1[index]!;
      const error = createProviderUnavailableToolErrorV1(reason);
      expect(error).toEqual({
        schemaVersion: 1,
        code: "provider_unavailable",
        details: { reason },
      });
      expect(fixtureCase.value).toEqual(error);
      expect(
        ProviderUnavailableToolErrorV1Schema.safeParse(fixtureCase.value)
          .success,
        fixtureCase.caseId,
      ).toBe(true);
      expect(ToolErrorEnvelopeV1Schema.safeParse(error).success).toBe(true);
      expect(
        McpToolErrorResultV1Schema.safeParse({
          isError: true,
          content: [
            {
              type: "text",
              text: "The strong Store is unavailable. Run Doctor for details.",
            },
          ],
          structuredContent: { error },
        }).success,
      ).toBe(true);
    }
  });

  it("rejects provider retry hints, private fields, extras, and absolute path text", () => {
    const error = createProviderUnavailableToolErrorV1("unavailable");
    const result = {
      isError: true,
      content: [
        {
          type: "text",
          text: "The strong Store is unavailable. Run Doctor for details.",
        },
      ],
      structuredContent: { error },
    };

    const invalidCases = providerErrorFixture("invalid").cases;
    expect(invalidCases).toHaveLength(15);
    for (const fixtureCase of invalidCases) {
      expect(
        ProviderUnavailableToolErrorV1Schema.safeParse(fixtureCase.value)
          .success,
        `${fixtureCase.caseId} must fail the Provider Schema`,
      ).toBe(false);
      expect(
        ToolErrorEnvelopeV1Schema.safeParse(fixtureCase.value).success,
        `${fixtureCase.caseId} must fail the MCP Tool Error union`,
      ).toBe(false);
      expect(
        McpToolErrorResultV1Schema.safeParse({
          ...result,
          structuredContent: { error: fixtureCase.value },
        }).success,
        `${fixtureCase.caseId} must fail the MCP result envelope`,
      ).toBe(false);
    }

    expect(
      McpToolErrorResultV1Schema.safeParse({
        ...result,
        structuredContent: {
          error: { ...error, retryable: true },
        },
      }).success,
    ).toBe(false);
    expect(
      McpToolErrorResultV1Schema.safeParse({
        ...result,
        structuredContent: {
          error: { ...error, debug: "not-public" },
        },
      }).success,
    ).toBe(false);
    expect(
      McpToolErrorResultV1Schema.safeParse({
        ...result,
        structuredContent: {
          error: {
            ...error,
            details: { reason: "unknown_provider_reason" },
          },
        },
      }).success,
    ).toBe(false);

    for (const [field, value] of Object.entries({
      providerId: "durable-object-provider:native-fs",
      locator: "provider-runtime:private",
      ipcEndpoint: "unix:///private/provider.sock",
      path: "/Users/example/private-provider",
      owner: "local-owner",
      username: "local-user",
      keyId: "0123456789abcdef012345",
      rawAttestation: "signed-private-attestation",
    })) {
      expect(
        McpToolErrorResultV1Schema.safeParse({
          ...result,
          structuredContent: {
            error: {
              ...error,
              details: { ...error.details, [field]: value },
            },
          },
        }).success,
        `${field} must not cross the public provider failure boundary`,
      ).toBe(false);
    }

    expect(
      McpToolErrorResultV1Schema.safeParse({
        ...result,
        content: [
          {
            type: "text",
            text: "Provider data failed at /Users/example/private-provider.",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("keeps provider error text path-safe in both Zod and tracked JSON Schema", () => {
    const trackedSchema = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL(
            "../schemas/v1/mcp-tool-error-result.schema.json",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    );
    const validateJsonSchema = new Ajv2020({
      allErrors: true,
      strict: false,
      validateFormats: false,
    }).compile(trackedSchema);
    const error = createProviderUnavailableToolErrorV1("unavailable");
    const resultForText = (text: string) => ({
      isError: true as const,
      content: [{ type: "text" as const, text }],
      structuredContent: { error },
    });

    for (const text of [
      "Provider failed at /Users/alice/private.",
      "Provider failed at //Users/alice/private.",
      "Provider failed at ///Users/alice/private.",
      "Provider failed at path:/Users/alice/private.",
      "Provider failed at C:\\Users\\alice\\private.",
      "Provider failed at \\\\server\\share\\private.",
      "Provider failed at file:///Users/alice/private.",
      "Provider failed at FILE:///Users/alice/private.",
    ]) {
      const result = resultForText(text);
      expect(
        McpToolErrorResultV1Schema.safeParse(result).success,
        `Zod accepted ${text}`,
      ).toBe(false);
      expect(
        validateJsonSchema(result),
        `JSON Schema accepted ${text}: ${JSON.stringify(validateJsonSchema.errors)}`,
      ).toBe(false);
    }

    for (const text of [
      "The strong Store is unavailable. Run Doctor for details.",
      "See https://example.test/provider for help.",
      "See custom://example.test/provider for help.",
    ]) {
      const result = resultForText(text);
      expect(
        McpToolErrorResultV1Schema.safeParse(result).success,
        `Zod rejected ${text}`,
      ).toBe(true);
      expect(
        validateJsonSchema(result),
        `JSON Schema rejected ${text}: ${JSON.stringify(validateJsonSchema.errors)}`,
      ).toBe(true);
    }
  });

  it("freezes the six mutually exclusive workspace binding reasons", () => {
    const reasons = [
      "root_conflict",
      "root_missing",
      "root_not_directory",
      "root_unavailable",
      "root_not_allowed",
      "secondary_session_required",
    ];
    expect(WorkspaceBindingReasonV1Schema.options).toEqual(reasons);

    for (const reason of reasons) {
      expect(
        McpToolErrorResultV1Schema.safeParse({
          isError: true,
          content: [
            {
              type: "text",
              text: "Workspace binding is required.",
            },
          ],
          structuredContent: {
            error: {
              schemaVersion: 1,
              code: "workspace_binding_required",
              details: { reason },
            },
          },
        }).success,
      ).toBe(true);
    }
  });

  it("rejects retry hints and absolute paths in public text or nested error details", () => {
    const baseError = {
      isError: true,
      content: [
        {
          type: "text",
          text: "The task changed since it was read.",
        },
      ],
      structuredContent: {
        error: {
          schemaVersion: 1,
          code: "revision_conflict",
          details: {
            taskId: TASK_ID,
            expectedRevision: 2,
            actualRevision: 3,
          },
        },
      },
    };
    expect(McpToolErrorResultV1Schema.safeParse(baseError).success).toBe(true);
    expect(
      McpToolErrorResultV1Schema.safeParse({
        ...baseError,
        structuredContent: {
          error: {
            ...baseError.structuredContent.error,
            retryable: true,
          },
        },
      }).success,
    ).toBe(false);
    expect(
      McpToolErrorResultV1Schema.safeParse({
        ...baseError,
        content: [
          {
            type: "text",
            text: "Failed at /Users/example/private-repository.",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      McpToolErrorResultV1Schema.safeParse({
        ...baseError,
        content: [
          {
            type: "text",
            text: 'Failed at "/Users/example/private-repository".',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      McpToolErrorResultV1Schema.safeParse({
        ...baseError,
        content: [
          {
            type: "text",
            text: "Failed at (C:\\private\\repository\\task.json).",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      McpToolErrorResultV1Schema.safeParse({
        ...baseError,
        content: [
          {
            type: "text",
            text: "Failed at \\\\server\\share\\repository\\task.json.",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      McpToolErrorResultV1Schema.safeParse({
        ...baseError,
        content: [
          {
            type: "text",
            text: "Failed at file:///Users/example/private-repository/task.json.",
          },
        ],
      }).success,
    ).toBe(false);
    for (const text of [
      "Failed at </Users/example/private-repository>.",
      "Failed at ,/Users/example/private-repository.",
      "Failed at path:/Users/example/private-repository.",
      "Failed at file:/Users/example/private-repository.",
    ]) {
      expect(
        McpToolErrorResultV1Schema.safeParse({
          ...baseError,
          content: [{ type: "text", text }],
        }).success,
      ).toBe(false);
    }
    for (const error of [
      {
        schemaVersion: 1,
        code: "invalid_arguments",
        details: {
          issues: [
            {
              path: ["task"],
              code: "invalid_value",
              message: "Invalid source at /Users/example/private-repository.",
            },
          ],
        },
      },
      {
        schemaVersion: 1,
        code: "resource_not_found",
        details: {
          resourceKind: "artifact",
          resourceId: "file:///Users/example/private-repository/task.json",
        },
      },
      {
        schemaVersion: 1,
        code: "refresh_failed",
        details: {
          operationId: "refresh-1",
          stage: "\\\\server\\share\\repository",
          errorId: "error-1",
        },
      },
    ]) {
      expect(
        McpToolErrorResultV1Schema.safeParse({
          isError: true,
          content: [{ type: "text", text: "The operation failed." }],
          structuredContent: { error },
        }).success,
      ).toBe(false);
    }
    expect(
      ToolErrorEnvelopeV1Schema.safeParse({
        schemaVersion: 1,
        code: "invalid_arguments",
        details: {
          issues: [
            {
              path: ["task"],
              code: "invalid_value",
              message: "Invalid source at /Users/example/private-repository.",
            },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it("keeps idempotency conflicts machine-readable without a retry hint", () => {
    expect(
      McpToolErrorResultV1Schema.safeParse({
        isError: true,
        content: [
          {
            type: "text",
            text: "The idempotency key was already used for another request.",
          },
        ],
        structuredContent: {
          error: {
            schemaVersion: 1,
            code: "idempotency_conflict",
            details: {
              idempotencyKey: "request-1",
              requestDigest: DIGEST,
              existingRequestDigest: OTHER_DIGEST,
            },
          },
        },
      }).success,
    ).toBe(true);
  });

  it("distinguishes lifecycle guards, gate failures, and authorization failures", () => {
    const errors = [
      {
        schemaVersion: 1,
        code: "task_transition_rejected",
        details: {
          taskId: TASK_ID,
          currentStatus: "created",
          requestedAction: "transition_status:verified",
          guard: "transition_not_allowed",
          allowedActions: ["transition_status:context_ready", "block_task"],
        },
      },
      {
        schemaVersion: 1,
        code: "task_gate_unsatisfied",
        details: {
          taskId: TASK_ID,
          targetStatus: "verified",
          failedGuards: [
            { code: "blocking_finding", resourceId: "finding-1" },
          ],
        },
      },
      {
        schemaVersion: 1,
        code: "action_not_authorized",
        details: {
          taskId: TASK_ID,
          action: "accept_verification_skip",
          reason: "owner_confirmation_required",
        },
      },
      {
        schemaVersion: 1,
        code: "schema_incompatible",
        details: {
          artifactType: "wiki_index",
          foundVersion: "2",
          supportedVersions: ["1", "2"],
        },
      },
    ] as const;

    for (const error of errors) {
      expect(
        McpToolErrorResultV1Schema.safeParse({
          isError: true,
          content: [{ type: "text", text: "The requested action was rejected." }],
          structuredContent: { error },
        }).success,
        error.code,
      ).toBe(true);
    }
  });
});

describe("workbench route and launch contract", () => {
  it("supports Task Home and task-scoped deep links without accepting arbitrary URLs", () => {
    expect(
      OpenWorkbenchInputV1Schema.safeParse({
        route: { view: "tasks" },
      }).success,
    ).toBe(true);
    expect(
      OpenWorkbenchInputV1Schema.safeParse({
        route: {
          view: "tasks",
          findingId: "finding-1",
        },
      }).success,
    ).toBe(false);

    const response = {
      content: [{ type: "text", text: "Workbench is ready." }],
      structuredContent: {
        schemaVersion: 1,
        meta: successMeta,
        result: {
          route: {
            view: "tasks",
            taskId: TASK_ID,
            section: "change-check",
          },
          deepLink:
            "http://127.0.0.1:43127/tasks/change-check#launch-token",
          launchTokenExpiresAt: "2026-07-28T08:01:00Z",
          runtime: {
            identity: {
              productVersion: "3.0.0-alpha.1",
              worktreeId: successMeta.worktreeId,
            },
            disposition: "reused",
          },
        },
      },
    };
    expect(OpenWorkbenchOutputV1Schema.safeParse(response).success).toBe(true);
    expect(
      OpenWorkbenchOutputV1Schema.safeParse({
        ...response,
        structuredContent: {
          ...response.structuredContent,
          result: {
            ...response.structuredContent.result,
            deepLink: "http://0.0.0.0:43127/tasks#launch-token",
          },
        },
      }).success,
    ).toBe(false);
    expect(
      OpenWorkbenchOutputV1Schema.safeParse({
        ...response,
        structuredContent: {
          ...response.structuredContent,
          result: {
            ...response.structuredContent.result,
            runtime: {
              ...response.structuredContent.result.runtime,
              identity: {
                ...response.structuredContent.result.runtime.identity,
                worktreeId: "worktree-other",
              },
            },
          },
        },
      }).success,
    ).toBe(false);
  });
});

describe("refresh progress and MCP request cancellation", () => {
  it("requires explicit full-mode Snapshot and Task read pins for knowledge publication", () => {
    const input = {
      mode: "full", expectedSourceSnapshotId: SNAPSHOT_ID,
      idempotencyKey: "knowledge-stage-1", actor: "codex",
      knowledge: { action: "stage", taskId: TASK_ID, expectedTaskRevision: 4 },
    };
    expect(RefreshIndexInputV1Schema.safeParse(input).success).toBe(true);
    expect(RefreshIndexInputV1Schema.safeParse({ ...input, mode: "incremental" }).success).toBe(false);
    expect(RefreshIndexInputV1Schema.safeParse({ ...input, expectedSourceSnapshotId: undefined }).success).toBe(false);
    expect(RefreshIndexInputV1Schema.safeParse({ ...input,
      knowledge: { ...input.knowledge, action: "publish" },
    }).success).toBe(false);
    expect(RefreshIndexInputV1Schema.safeParse({ ...input,
      knowledge: { ...input.knowledge, action: "publish", candidateGenerationId: `generation-${"a".repeat(64)}` },
    }).success).toBe(true);
    expect(RefreshIndexInputV1Schema.safeParse({ ...input,
      knowledge: { ...input.knowledge, action: "publish", candidateGenerationId: "../other" },
    }).success).toBe(false);
    expect(RefreshIndexInputV1Schema.safeParse({ ...input,
      knowledge: { ...input.knowledge, status: "verified" },
    }).success).toBe(false);
  });

  it("uses the refresh tool's operation control without adding a cancel tool", () => {
    expect(
      RefreshIndexInputV1Schema.safeParse({
        mode: "full",
        expectedSourceSnapshotId: SNAPSHOT_ID,
        idempotencyKey: "refresh-2",
        actor: "codex",
      }).success,
    ).toBe(true);
    expect(
      RefreshIndexInputV1Schema.safeParse({
        mode: "full",
        idempotencyKey: "refresh-2",
        actor: "codex",
        cancelOperationId: "operation-1",
      }).success,
    ).toBe(false);
  });

  it("correlates progress and cancellation to the MCP request", () => {
    expect(
      McpProgressRequestMetaV1Schema.safeParse({
        progressToken: "progress-42",
      }).success,
    ).toBe(true);
    expect(
      McpProgressNotificationV1Schema.safeParse({
        jsonrpc: "2.0",
        method: "notifications/progress",
        params: {
          progressToken: "progress-42",
          progress: 80,
          total: 100,
          message: "Building repository graph.",
        },
      }).success,
    ).toBe(true);
    expect(
      RefreshIndexProgressV1Schema.safeParse({
        schemaVersion: 1,
        operationId: "operation-1",
        stage: "building_graph",
        processed: 80,
        total: 100,
        message: "Building repository graph.",
        cancellable: true,
        lastAvailableSnapshotId: SNAPSHOT_ID,
      }).success,
    ).toBe(true);
    expect(
      RefreshIndexProgressV1Schema.safeParse({
        schemaVersion: 1,
        operationId: "operation-1",
        stage: "committing_snapshot",
        processed: 100,
        total: 100,
        cancellable: true,
      }).success,
    ).toBe(false);
    expect(
      RefreshIndexCancellationV1Schema.safeParse({
        mechanism: "mcp_request_cancellation",
        notificationMethod: "notifications/cancelled",
        effect: "cooperative_stop_preserve_last_snapshot",
      }).success,
    ).toBe(true);
    expect(
      McpCancelledNotificationV1Schema.safeParse({
        jsonrpc: "2.0",
        method: "notifications/cancelled",
        params: {
          requestId: 42,
          reason: "User requested cancellation.",
        },
      }).success,
    ).toBe(true);
  });
});
