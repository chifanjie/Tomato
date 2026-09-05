import { z } from "zod";

import {
  AlphaGoldGateEvidenceV1Schema,
  AlphaGoldRunnerContractV1Schema,
  AlphaGoldTaskCorpusV1Schema,
  Step16DualHostBlockedEvidenceV1Schema,
  Step16DualHostEligibleEvidenceV1Schema,
  Step16DualHostEvidenceV1Schema,
} from "./alpha-gold.js";
import { AlphaGoldTaskDefinitionManifestV1Schema } from "./alpha-gold-task-definitions.js";

import {
  ArtifactEnvelopeBaseV1Schema,
} from "./artifact-envelope.js";
import {
  ChangeCheckArtifactV1Schema,
  ChangeCheckV1Schema,
  ChangeFindingV1Schema,
  ImpactArtifactV1Schema,
  ImpactPathV1Schema,
  VerificationArtifactV1Schema,
  VerificationRecordV1Schema,
} from "./change.js";
import {
  ClaimLedgerArtifactV1Schema,
  ClaimV1Schema,
  EvidenceLedgerArtifactV1Schema,
  EvidenceV1Schema,
} from "./evidence.js";
import { TaskArtifactBundleV1Schema } from "./invariants.js";
import {
  TaskOperationJournalArtifactV1Schema,
  TaskOperationJournalPayloadV1Schema,
  TaskOperationReceiptV1Schema,
} from "./operation-journal.js";
import {
  McpToolErrorResultV1Schema,
  P0_MCP_TOOL_CONTRACTS_V1,
  ToolErrorEnvelopeV1Schema,
} from "./mcp.js";
import {
  ArtifactDescriptorV1Schema,
  ArtifactManifestV1Schema,
  LegacyRawArtifactDescriptorV1Schema,
} from "./descriptors.js";
import {
  RepoPulseArtifactV1Schema,
  RepoPulsePersistedPayloadV1Schema,
  RepoPulseSurfaceResponseV1Schema,
  RepoPulseV1Schema,
  RepositorySnapshotArtifactV1Schema,
  RepositorySnapshotPersistedPayloadV1Schema,
  RepositorySnapshotSurfaceResponseV1Schema,
  RepositorySnapshotV1Schema,
  StrongRepoPulseV1Schema,
  StrongRepositorySnapshotV1Schema,
} from "./repository.js";
import {
  TaskBriefArtifactV1Schema,
  TaskBriefV1Schema,
  TaskEventV1Schema,
  TaskManifestArtifactV1Schema,
  TaskManifestV1Schema,
} from "./task.js";
import {
  Step16ProviderReceiptBindingV1Schema,
  Step16RealHostActionReceiptV1Schema,
  Step16RealHostEventV1Schema,
  Step16RealHostToolCallReceiptV1Schema,
} from "./step16-host-receipts.js";

export const CONTRACT_JSON_SCHEMA_SOURCES_V1 = {
  "alpha-gold-task-corpus": AlphaGoldTaskCorpusV1Schema,
  "alpha-gold-task-definition-manifest": AlphaGoldTaskDefinitionManifestV1Schema,
  "alpha-gold-runner-contract": AlphaGoldRunnerContractV1Schema,
  "alpha-gold-gate-evidence": AlphaGoldGateEvidenceV1Schema,
  "step16-dual-host-blocked-evidence": Step16DualHostBlockedEvidenceV1Schema,
  "step16-dual-host-eligible-evidence": Step16DualHostEligibleEvidenceV1Schema,
  "step16-dual-host-evidence": Step16DualHostEvidenceV1Schema,
  "step16-real-host-tool-call-receipt": Step16RealHostToolCallReceiptV1Schema,
  "step16-real-host-action-receipt": Step16RealHostActionReceiptV1Schema,
  "step16-real-host-event": Step16RealHostEventV1Schema,
  "step16-provider-receipt-binding": Step16ProviderReceiptBindingV1Schema,
  "artifact-envelope": ArtifactEnvelopeBaseV1Schema,
  "artifact-descriptor": ArtifactDescriptorV1Schema,
  "artifact-manifest": ArtifactManifestV1Schema,
  "legacy-raw-artifact-descriptor": LegacyRawArtifactDescriptorV1Schema,
  "repository-snapshot": RepositorySnapshotV1Schema,
  "strong-repository-snapshot": StrongRepositorySnapshotV1Schema,
  "repository-snapshot-persisted-payload": RepositorySnapshotPersistedPayloadV1Schema,
  "repository-snapshot-surface-response": RepositorySnapshotSurfaceResponseV1Schema,
  "repository-snapshot-artifact": RepositorySnapshotArtifactV1Schema,
  "repo-pulse": RepoPulseV1Schema,
  "strong-repo-pulse": StrongRepoPulseV1Schema,
  "repo-pulse-persisted-payload": RepoPulsePersistedPayloadV1Schema,
  "repo-pulse-surface-response": RepoPulseSurfaceResponseV1Schema,
  "repo-pulse-artifact": RepoPulseArtifactV1Schema,
  "task-manifest": TaskManifestV1Schema,
  "task-manifest-artifact": TaskManifestArtifactV1Schema,
  "task-brief": TaskBriefV1Schema,
  "task-brief-artifact": TaskBriefArtifactV1Schema,
  claim: ClaimV1Schema,
  "claim-ledger-artifact": ClaimLedgerArtifactV1Schema,
  evidence: EvidenceV1Schema,
  "evidence-ledger-artifact": EvidenceLedgerArtifactV1Schema,
  "impact-path": ImpactPathV1Schema,
  "impact-artifact": ImpactArtifactV1Schema,
  "change-finding": ChangeFindingV1Schema,
  "change-check": ChangeCheckV1Schema,
  "change-check-artifact": ChangeCheckArtifactV1Schema,
  "verification-record": VerificationRecordV1Schema,
  "verification-artifact": VerificationArtifactV1Schema,
  "task-event": TaskEventV1Schema,
  "task-operation-receipt": TaskOperationReceiptV1Schema,
  "task-operation-journal": TaskOperationJournalPayloadV1Schema,
  "task-operation-journal-artifact": TaskOperationJournalArtifactV1Schema,
  "task-artifact-bundle": TaskArtifactBundleV1Schema,
  "tool-error-envelope": ToolErrorEnvelopeV1Schema,
  "mcp-tool-error-result": McpToolErrorResultV1Schema,
} as const satisfies Record<string, z.ZodType>;

export type ContractJsonSchemaNameV1 =
  | keyof typeof CONTRACT_JSON_SCHEMA_SOURCES_V1
  | `${keyof typeof P0_MCP_TOOL_CONTRACTS_V1}-input`
  | `${keyof typeof P0_MCP_TOOL_CONTRACTS_V1}-output`;

export interface ContractJsonSchemaDocumentV1 {
  $id: string;
  $schema?: string;
  [keyword: string]: unknown;
}

function normalizeEmptyTupleSchemasV1(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) normalizeEmptyTupleSchemasV1(entry);
    return;
  }
  if (value === null || typeof value !== "object") return;

  const schema = value as Record<string, unknown>;
  const prefixItems = schema.prefixItems;
  if (Array.isArray(prefixItems) && prefixItems.length === 0) {
    delete schema.prefixItems;
    schema.items = false;
    schema.minItems = 0;
    schema.maxItems = 0;
  }
  for (const entry of Object.values(schema)) {
    normalizeEmptyTupleSchemasV1(entry);
  }
}

function alphaGoldHostExecutionCountCasesV1(): Record<string, unknown> {
  const branch = (
    status: "passed" | "g2_subset_passed" | "failed" | "not_run" | "blocked",
    passedTasks: number,
    alphaAPassedTasks: number,
    alphaBPassedTasks: number,
  ) => ({
    type: "object",
    properties: {
      status: { const: status },
      passedTasks: { const: passedTasks },
      alphaAPassedTasks: { const: alphaAPassedTasks },
      alphaBPassedTasks: { const: alphaBPassedTasks },
    },
    required: [
      "status",
      "passedTasks",
      "alphaAPassedTasks",
      "alphaBPassedTasks",
    ],
  });
  const cases: Array<Record<string, unknown>> = [
    branch("passed", 24, 18, 6),
    branch("not_run", 0, 0, 0),
    branch("blocked", 0, 0, 0),
  ];
  for (let alphaA = 0; alphaA <= 18; alphaA += 1) {
    for (let alphaB = 0; alphaB <= 6; alphaB += 1) {
      const total = alphaA + alphaB;
      if (total >= 1 && total <= 23) {
        cases.push(branch("g2_subset_passed", total, alphaA, alphaB));
      }
      if (total <= 23) {
        cases.push(branch("failed", total, alphaA, alphaB));
      }
    }
  }
  return { anyOf: cases };
}

function alphaGoldGateEvidenceTransportInvariantsV1(): Array<Record<string, unknown>> {
  const exactPassedHost = {
    type: "object",
    properties: {
      status: { const: "passed" },
      passedTasks: { const: 24 },
      alphaAPassedTasks: { const: 18 },
      alphaBPassedTasks: { const: 6 },
    },
    required: [
      "status",
      "passedTasks",
      "alphaAPassedTasks",
      "alphaBPassedTasks",
    ],
  };
  const qualifyingHost = {
    anyOf: [
      exactPassedHost,
      {
        type: "object",
        properties: {
          status: { const: "g2_subset_passed" },
          passedTasks: { type: "integer", minimum: 12, maximum: 23 },
        },
        required: ["status", "passedTasks"],
      },
    ],
  };
  const availableGoldSources = {
    type: "object",
    properties: {
      taskDefinitionStatus: { const: "versioned_two_person_reviewed" },
      sources: {
        type: "object",
        properties: {
          alphaA: {
            type: "object",
            properties: { materializableFromRepository: { const: true } },
            required: ["materializableFromRepository"],
          },
          alphaB: {
            type: "object",
            properties: {
              ownerAuthorizationObserved: { const: true },
              localCorpusAvailable: { const: true },
            },
            required: ["ownerAuthorizationObserved", "localCorpusAvailable"],
          },
        },
        required: ["alphaA", "alphaB"],
      },
    },
    required: ["taskDefinitionStatus", "sources"],
  };
  const hostRunsWithQualifier = {
    type: "object",
    properties: {
      hostRuns: {
        type: "object",
        anyOf: [
          { properties: { codex: qualifyingHost }, required: ["codex"] },
          { properties: { claude: qualifyingHost }, required: ["claude"] },
        ],
      },
    },
    required: ["hostRuns"],
  };
  const bothHostsPassed = {
    type: "object",
    properties: {
      hostRuns: {
        type: "object",
        properties: { codex: exactPassedHost, claude: exactPassedHost },
        required: ["codex", "claude"],
      },
    },
    required: ["hostRuns"],
  };
  return [
    {
      properties: {
        hostRuns: {
          type: "object",
          properties: {
            codex: alphaGoldHostExecutionCountCasesV1(),
            claude: alphaGoldHostExecutionCountCasesV1(),
          },
          required: ["codex", "claude"],
        },
      },
      required: ["hostRuns"],
    },
    {
      if: {
        properties: {
          g2: {
            type: "object",
            properties: { status: { const: "eligible" } },
            required: ["status"],
          },
        },
        required: ["g2"],
      },
      then: {
        ...hostRunsWithQualifier,
      },
    },
    {
      if: { allOf: [availableGoldSources, hostRunsWithQualifier] },
      then: {
        properties: {
          g2: {
            type: "object",
            properties: { status: { const: "eligible" } },
            required: ["status"],
          },
        },
        required: ["g2"],
      },
    },
    {
      if: {
        properties: {
          g3: {
            type: "object",
            properties: { status: { const: "eligible" } },
            required: ["status"],
          },
        },
        required: ["g3"],
      },
      then: {
        allOf: [
          bothHostsPassed,
          {
            properties: {
          g2: {
            type: "object",
            properties: {
              status: { const: "eligible" },
            },
            required: ["status"],
          },
            },
            required: ["g2"],
          },
        ],
      },
    },
    {
      if: {
        allOf: [
          availableGoldSources,
          bothHostsPassed,
          {
            properties: {
              g3: {
                type: "object",
                properties: {
                  artifactTaskRevisionIdentityMatched: { const: true },
                },
                required: ["artifactTaskRevisionIdentityMatched"],
              },
            },
            required: ["g3"],
          },
        ],
      },
      then: {
        properties: {
          g3: {
            type: "object",
            properties: { status: { const: "eligible" } },
            required: ["status"],
          },
        },
        required: ["g3"],
      },
    },
  ];
}

/**
 * Zod refinements cannot be represented by z.toJSONSchema.  Keep the
 * independently consumable Gold definition schema at the same structural
 * boundary as the runtime parser: tuple lengths, relative paths, and the
 * conditional review gate must be enforced by JSON Schema as well.
 */
function alphaGoldTaskDefinitionManifestTransportInvariantsV1(
  generated: Record<string, unknown>,
): void {
  const properties = generated.properties;
  if (properties === null || typeof properties !== "object") return;
  const definitions = (properties as Record<string, unknown>).definitions;
  if (definitions === null || typeof definitions !== "object") return;
  const definitionItems = (definitions as Record<string, unknown>).items;
  if (definitionItems === null || typeof definitionItems !== "object") return;
  const item = definitionItems as Record<string, unknown>;
  const itemProperties = item.properties;
  if (itemProperties === null || typeof itemProperties !== "object") return;
  const taskProperties = itemProperties as Record<string, unknown>;

  const slotId = taskProperties.slotId;
  if (slotId !== null && typeof slotId === "object") {
    (slotId as Record<string, unknown>).pattern =
      "^(?:alpha-a-slot-(?:0[1-9]|1[0-8])|alpha-b-slot-0[1-6])$";
  }
  const targetPaths = taskProperties.targetPaths;
  if (targetPaths !== null && typeof targetPaths === "object") {
    const targetPathItems = (targetPaths as Record<string, unknown>).items;
    if (targetPathItems !== null && typeof targetPathItems === "object") {
      (targetPathItems as Record<string, unknown>).pattern =
        "^(?!/)(?![A-Za-z]:[\\\\/])(?!.*(?:^|[\\\\/])\\.\\.(?:[\\\\/]|$)).+";
    }
  }
  const requiredStages = taskProperties.requiredStages;
  if (requiredStages !== null && typeof requiredStages === "object") {
    Object.assign(requiredStages as Record<string, unknown>, {
      minItems: 4,
      maxItems: 4,
    });
  }
  const coverageTags = taskProperties.coverageTags;
  if (coverageTags !== null && typeof coverageTags === "object") {
    (coverageTags as Record<string, unknown>).uniqueItems = true;
  }

  const approvedReview = {
    type: "object",
    properties: {
      status: { const: "approved" },
      reviewerIds: {
        type: "array",
        prefixItems: [
          { type: "string", minLength: 1, maxLength: 256 },
          { type: "string", minLength: 1, maxLength: 256 },
        ],
        items: false,
        minItems: 2,
        maxItems: 2,
        uniqueItems: true,
      },
      reviewedAt: {
        type: "string",
        pattern: "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?Z$",
      },
    },
    required: ["status", "reviewerIds", "reviewedAt"],
    additionalProperties: false,
  };
  const review = taskProperties.review;
  if (review !== null && typeof review === "object") {
    const reviewSchema = review as Record<string, unknown>;
    const oneOf = reviewSchema.oneOf;
    if (Array.isArray(oneOf)) {
      const existingApproved = oneOf.find((entry) =>
        entry !== null && typeof entry === "object" &&
        (entry as Record<string, unknown>).properties !== null &&
        typeof (entry as Record<string, unknown>).properties === "object" &&
        ((entry as Record<string, unknown>).properties as Record<string, unknown>).status !== null &&
        typeof ((entry as Record<string, unknown>).properties as Record<string, unknown>).status === "object" &&
        (((entry as Record<string, unknown>).properties as Record<string, unknown>).status as Record<string, unknown>).const === "approved",
      );
      if (existingApproved !== undefined && typeof existingApproved === "object") {
        Object.assign(existingApproved as Record<string, unknown>, approvedReview);
      }
    }
  }

  item.allOf = [
    {
      if: {
        properties: { corpus: { const: "alpha-b" } },
        required: ["corpus"],
      },
      then: { properties: { ordinal: { maximum: 6 } } },
    },
    {
      if: {
        properties: { corpus: { const: "alpha-a" } },
        required: ["corpus"],
      },
      then: { properties: { slotId: { pattern: "^alpha-a-slot-[0-9]{2}$" } } },
    },
    {
      if: {
        properties: { corpus: { const: "alpha-b" } },
        required: ["corpus"],
      },
      then: { properties: { slotId: { pattern: "^alpha-b-slot-[0-9]{2}$" } } },
    },
  ];

  const ownerReview = (properties as Record<string, unknown>).ownerReview;
  const status = (properties as Record<string, unknown>).status;
  if (ownerReview !== null && typeof ownerReview === "object" && status !== null && typeof status === "object") {
    generated.allOf = [
      {
        if: {
          properties: { status: { const: "versioned_two_person_reviewed" } },
          required: ["status"],
        },
        then: {
          properties: {
            ownerReview: approvedReview,
            definitions: { items: { properties: { review: approvedReview } } },
          },
        },
      },
    ];
  }
}

function schemaDocument(
  name: ContractJsonSchemaNameV1,
  schema: z.ZodType,
): ContractJsonSchemaDocumentV1 {
  const generated = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    unrepresentable: "any",
  }) as unknown as Record<string, unknown>;
  normalizeEmptyTupleSchemasV1(generated);
  if (name === "alpha-gold-gate-evidence") {
    generated.allOf = alphaGoldGateEvidenceTransportInvariantsV1();
  }
  if (name === "alpha-gold-task-definition-manifest") {
    alphaGoldTaskDefinitionManifestTransportInvariantsV1(generated);
  }
  return {
    $id: `urn:understand-code:schema:v1:${name}`,
    ...generated,
  };
}

/**
 * Generates transport schemas without filesystem access.
 *
 * Cross-record and digest semantics remain authoritative in the Zod parsers;
 * JSON Schema intentionally covers the portable structural subset.
 */
export function generateContractJsonSchemasV1(): Record<
  ContractJsonSchemaNameV1,
  ContractJsonSchemaDocumentV1
> {
  const generated: Partial<
    Record<ContractJsonSchemaNameV1, ContractJsonSchemaDocumentV1>
  > = {};

  for (const [name, schema] of Object.entries(
    CONTRACT_JSON_SCHEMA_SOURCES_V1,
  ) as Array<
    [keyof typeof CONTRACT_JSON_SCHEMA_SOURCES_V1, z.ZodType]
  >) {
    generated[name] = schemaDocument(name, schema);
  }

  for (const [toolName, contract] of Object.entries(
    P0_MCP_TOOL_CONTRACTS_V1,
  ) as Array<
    [
      keyof typeof P0_MCP_TOOL_CONTRACTS_V1,
      { readonly input: z.ZodType; readonly output: z.ZodType },
    ]
  >) {
    const inputName = `${toolName}-input` as const;
    const outputName = `${toolName}-output` as const;
    generated[inputName] = schemaDocument(inputName, contract.input);
    generated[outputName] = schemaDocument(outputName, contract.output);
  }

  return generated as Record<
    ContractJsonSchemaNameV1,
    ContractJsonSchemaDocumentV1
  >;
}
