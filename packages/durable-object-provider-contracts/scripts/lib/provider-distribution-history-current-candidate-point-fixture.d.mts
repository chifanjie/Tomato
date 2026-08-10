type JsonRecordV1 = Record<string, any>;

export const GOLDEN_RESOURCE_PATH: string;
export const INVALID_RESOURCE_PATH: string;
export const GOLDEN_SEMANTIC_DOMAIN: string;
export const INVALID_SEMANTIC_DOMAIN: string;
export const INVALID_MATERIALIZED_REQUEST_DOMAIN: string;
export const INVALID_RECIPE_DIALECT: string;
export const POSITIVE_VECTOR_IDS: readonly [
  "genesis",
  "two-generation-shared",
  "two-generation-distinct",
];
export const INVALID_CASE_IDS: readonly string[];
export const INVALID_CASE_DEFINITIONS: readonly Readonly<{
  caseId: string;
  group: string;
  baseVectorId: string;
  stage: string;
  reason: string;
  operation: Readonly<JsonRecordV1>;
}>[];

export function jsonClone<T>(value: T): T;
export function sha256Hex(bytes: Uint8Array): string;
export function semanticDigest(domain: string, value: unknown): string;
export function prettyBytes(value: unknown): Uint8Array;
export function buildGenesisHistoryRawRequest(
  catalogGolden: JsonRecordV1,
): JsonRecordV1;
export function buildTwoGenerationHistoryFixture(
  catalogGolden: JsonRecordV1,
  options?: Readonly<{
    historicalSemanticTamper?:
      | "none"
      | "suite_cases_order"
      | "fixture_record_ordinal"
      | "result_target_count"
      | "universe_discovered_count"
      | "catalog_target_order";
    historicalSignatureTamper?: "none" | "bundle" | "suite" | "corpus";
    retainedSourceRelationship?: "distinct" | "shared";
  }>,
): Readonly<{
  request: JsonRecordV1;
  current: Readonly<{
    catalog: JsonRecordV1;
    discovery: JsonRecordV1;
    matrix: JsonRecordV1;
    taxonomy: JsonRecordV1;
    universe: JsonRecordV1;
  }>;
}>;
export function buildPositiveRawRequest(
  catalogGolden: JsonRecordV1,
  vectorId:
    | "genesis"
    | "two-generation-shared"
    | "two-generation-distinct",
): JsonRecordV1;
export function buildInvalidCase(
  catalogGolden: JsonRecordV1,
  caseId: string,
): Readonly<{
  caseId: string;
  group: string;
  baseVectorId: string;
  recipe: Readonly<{
    dialect: string;
    operations: readonly Readonly<{
      kind: "replace" | "add";
      field: string;
      value: unknown;
    }>[];
  }>;
  request: JsonRecordV1;
  expected: Readonly<{ stage: string; reason: string }>;
}>;
