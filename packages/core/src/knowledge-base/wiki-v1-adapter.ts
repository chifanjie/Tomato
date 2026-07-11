import { z } from "zod";
import {
  parseWikiIndexV2,
  type WikiDocumentCategory,
  type WikiEvidenceV2,
  type WikiIndexV2,
  type WikiNodeDocumentationV2,
  type WikiPageV2,
  type WikiParseResult,
} from "./wiki-contract.js";

const WikiPageCategoryV1Schema = z.enum([
  "overview",
  "capability",
  "flow",
  "module",
  "file",
  "symbol",
  "gap",
  "quality",
  "other",
]);

const WikiPageV1Schema = z.strictObject({
  id: z.string(),
  title: z.string(),
  category: WikiPageCategoryV1Schema,
  summary: z.string(),
  markdownPath: z.string(),
  explainedNodeIds: z.array(z.string()),
  relatedNodeIds: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  coverage: z.enum(["complete", "partial"]),
  quality: z.enum(["verified", "generated", "low-confidence"]),
  qualityIssues: z.array(z.string()).optional(),
  searchTerms: z.array(z.string()).optional(),
});

const WikiSourceV1Schema = z.strictObject({
  outputLanguage: z.string().optional(),
  graphDigest: z.string().optional(),
  generationMode: z.string().optional(),
  coverageStatus: z.string().optional(),
  gitCommitHash: z.string().optional(),
  graphAnalyzedAt: z.string().optional(),
});

const WikiEvidenceV1Schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  filePath: z.string().optional(),
  lineRange: z.tuple([z.number(), z.number()]).optional(),
  nodeIds: z.array(z.string()),
});

const WikiGapV1Schema = z.strictObject({
  id: z.string(),
  nodeId: z.string(),
  reason: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});

const WikiIndexV1Schema = z.strictObject({
  version: z.literal(1),
  generatedAt: z.string(),
  projectName: z.string(),
  source: WikiSourceV1Schema.optional(),
  pages: z.array(WikiPageV1Schema),
  evidence: z.array(WikiEvidenceV1Schema),
  gaps: z.array(WikiGapV1Schema),
});

type WikiIndexV1 = z.infer<typeof WikiIndexV1Schema>;
type WikiPageCategoryV1 = z.infer<typeof WikiPageCategoryV1Schema>;
type WikiEvidenceV1 = z.infer<typeof WikiEvidenceV1Schema>;

export type ParsedWikiIndex =
  | { ok: true; value: WikiIndexV2; errors: []; sourceVersion: 1 | 2 }
  | { ok: false; errors: string[] };

function formatV1SchemaErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map((segment) => String(segment)).join(".");
    const prefix = path.length === 0 ? "" : `${path}：`;

    switch (issue.code) {
      case "invalid_type":
        return `${prefix}字段类型不正确`;
      case "invalid_value":
        return `${prefix}字段值不在旧版 Wiki 契约允许范围内`;
      case "too_small":
        return `${prefix}字段值小于允许下限`;
      case "too_big":
        return `${prefix}字段值大于允许上限`;
      case "invalid_format":
        return `${prefix}字段格式不正确`;
      case "not_multiple_of":
        return `${prefix}字段值不是允许的倍数`;
      case "unrecognized_keys":
        return `${prefix}包含旧版 Wiki 契约未声明的字段`;
      case "invalid_union":
        return `${prefix}字段值不符合任一允许结构`;
      case "invalid_key":
        return `${prefix}对象键不符合旧版 Wiki 契约`;
      case "invalid_element":
        return `${prefix}集合元素不符合旧版 Wiki 契约`;
      case "custom":
        return `${prefix}字段值不符合旧版 Wiki 契约约束`;
      default:
        return `${prefix}字段值不符合旧版 Wiki 契约`;
    }
  });
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function mapCategory(category: WikiPageCategoryV1): WikiDocumentCategory {
  if (category === "symbol") return "topic";
  if (category === "gap") return "coverage";
  return category;
}

function hasValidLineRange(
  evidence: WikiEvidenceV1,
): evidence is WikiEvidenceV1 & { filePath: string; lineRange: [number, number] } {
  if (evidence.filePath === undefined || evidence.filePath.trim().length === 0) return false;
  if (evidence.lineRange === undefined) return false;
  const [start, end] = evidence.lineRange;
  return Number.isInteger(start) && Number.isInteger(end) && start > 0 && end >= start;
}

function retainEvidence(evidence: WikiEvidenceV1): WikiEvidenceV2 | undefined {
  const nodeIds = uniqueSorted(evidence.nodeIds.filter((nodeId) => nodeId.trim().length > 0));
  if (nodeIds.length === 0 || !hasValidLineRange(evidence)) return undefined;

  return {
    id: evidence.id,
    nodeIds,
    filePath: evidence.filePath,
    lineRange: evidence.lineRange,
    evidenceType: "production",
  };
}

function adaptPages(index: WikiIndexV1, retainedEvidenceIds: ReadonlySet<string>): WikiPageV2[] {
  return index.pages.map((page) => {
    const directNodeIds = uniqueSorted(page.explainedNodeIds);
    const directNodeIdSet = new Set(directNodeIds);
    const contextNodeIds = uniqueSorted(
      page.relatedNodeIds.filter((nodeId) => !directNodeIdSet.has(nodeId)),
    );

    return {
      id: page.id,
      title: page.title,
      summary: page.summary,
      markdownPath: page.markdownPath,
      role: page.category === "gap" || page.category === "quality" ? "maintenance" : "reference",
      category: mapCategory(page.category),
      quality: "needs-review",
      generationStatus: "partial",
      directNodeIds,
      contextNodeIds,
      evidenceIds: uniqueSorted(page.evidenceIds.filter((evidenceId) => retainedEvidenceIds.has(evidenceId))),
      searchTerms: [...(page.searchTerms ?? [])],
    };
  });
}

function adaptNodeDocumentation(
  pages: readonly WikiPageV2[],
  evidence: readonly WikiEvidenceV2[],
): WikiNodeDocumentationV2[] {
  const nodeIds = uniqueSorted([
    ...pages.flatMap((page) => page.directNodeIds),
    ...pages.flatMap((page) => page.contextNodeIds),
    ...evidence.flatMap((item) => item.nodeIds),
  ]);

  return nodeIds.map((nodeId) => {
    const directPageIds = uniqueSorted(
      pages.filter((page) => page.directNodeIds.includes(nodeId)).map((page) => page.id),
    );
    const contextPageIds = uniqueSorted(
      pages.filter((page) => page.contextNodeIds.includes(nodeId)).map((page) => page.id),
    );
    const evidenceIds = uniqueSorted(
      evidence.filter((item) => item.nodeIds.includes(nodeId)).map((item) => item.id),
    );

    return {
      nodeId,
      relation: directPageIds.length > 0 ? "direct" : contextPageIds.length > 0 ? "context" : "none",
      quality: "needs-review",
      evidenceHealth: evidenceIds.length > 0 ? "weak" : "missing",
      generationStatus: "partial",
      referenceCoverage: "unanchored",
      directPageIds,
      contextPageIds,
      evidenceIds,
    };
  });
}

function convertWikiIndexV1(index: WikiIndexV1): WikiIndexV2 {
  const evidence = index.evidence.flatMap((item) => {
    const retained = retainEvidence(item);
    return retained === undefined ? [] : [retained];
  });
  const retainedEvidenceIds = new Set(evidence.map((item) => item.id));
  const pages = adaptPages(index, retainedEvidenceIds);
  const emptyCount = { covered: 0, total: 0, missingIds: [] };

  return {
    version: 2,
    generatedAt: index.generatedAt,
    projectName: index.projectName,
    source: {
      outputLanguage: index.source?.outputLanguage ?? "unknown",
      generationMode: "v1-adapter",
      ...(index.source?.graphDigest === undefined ? {} : { graphDigest: index.source.graphDigest }),
      ...(index.source?.gitCommitHash === undefined ? {} : { gitCommitHash: index.source.gitCommitHash }),
    },
    mainReadiness: {
      status: "blocked",
      reasons: ["旧版知识库需重新生成后才能评估主干可读性"],
      routePageIds: [],
    },
    referenceCoverage: {
      status: "partial",
      files: { ...emptyCount, missingIds: [] },
      functions: { ...emptyCount, missingIds: [] },
      types: { ...emptyCount, missingIds: [] },
    },
    pages,
    nodeDocumentation: adaptNodeDocumentation(pages, evidence),
    evidence,
  };
}

export function isWikiIndexV1(value: unknown): boolean {
  return WikiIndexV1Schema.safeParse(value).success;
}

export function adaptWikiIndexV1(value: unknown): WikiParseResult<WikiIndexV2> {
  const parsed = WikiIndexV1Schema.safeParse(value);
  if (!parsed.success) return { ok: false, errors: formatV1SchemaErrors(parsed.error) };
  return parseWikiIndexV2(convertWikiIndexV1(parsed.data));
}

export function parseWikiIndex(value: unknown): ParsedWikiIndex {
  const parsedV2 = parseWikiIndexV2(value);
  if (parsedV2.ok) return { ...parsedV2, sourceVersion: 2 };

  const version = typeof value === "object" && value !== null && "version" in value
    ? value.version
    : undefined;
  if (version === 2) return parsedV2;

  const parsedV1 = adaptWikiIndexV1(value);
  if (parsedV1.ok) return { ...parsedV1, sourceVersion: 1 };
  if (version === 1) return parsedV1;

  return { ok: false, errors: ["不支持的 Wiki 索引版本"] };
}
