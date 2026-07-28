import { z } from "zod";

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
  RepoPulseV1Schema,
  RepositorySnapshotArtifactV1Schema,
  RepositorySnapshotV1Schema,
} from "./repository.js";
import {
  TaskBriefArtifactV1Schema,
  TaskBriefV1Schema,
  TaskEventV1Schema,
  TaskManifestArtifactV1Schema,
  TaskManifestV1Schema,
} from "./task.js";

export const CONTRACT_JSON_SCHEMA_SOURCES_V1 = {
  "artifact-envelope": ArtifactEnvelopeBaseV1Schema,
  "artifact-descriptor": ArtifactDescriptorV1Schema,
  "artifact-manifest": ArtifactManifestV1Schema,
  "legacy-raw-artifact-descriptor": LegacyRawArtifactDescriptorV1Schema,
  "repository-snapshot": RepositorySnapshotV1Schema,
  "repository-snapshot-artifact": RepositorySnapshotArtifactV1Schema,
  "repo-pulse": RepoPulseV1Schema,
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

function schemaDocument(
  name: ContractJsonSchemaNameV1,
  schema: z.ZodType,
): ContractJsonSchemaDocumentV1 {
  const generated = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    unrepresentable: "any",
  }) as unknown as Record<string, unknown>;
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
