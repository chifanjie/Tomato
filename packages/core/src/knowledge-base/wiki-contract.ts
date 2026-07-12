import { z } from "zod";

export type WikiDocumentRole = "featured" | "reference" | "maintenance";
export type WikiDocumentCategory = "overview" | "capability" | "flow" | "module" | "topic" | "file" | "quality" | "coverage" | "other";
export type DocumentationRelation = "direct" | "context" | "none";
export type ContentQuality = "verified" | "generated" | "needs-review" | "failed";
export type EvidenceHealth = "source-linked" | "weak" | "unreadable" | "missing";
export type GenerationStatus = "complete" | "partial" | "failed";
export type ReferenceCoverage = "anchored" | "unanchored" | "not-applicable";
export type MainReadiness = "ready" | "degraded" | "blocked";
export type RouteStage = "purpose" | "flow" | "rule" | "implementation" | "evidence";

export interface CountSummaryV2 {
  covered: number;
  total: number;
  missingIds: string[];
}

export interface MainReadinessSummaryV2 {
  status: MainReadiness;
  reasons: string[];
  routePageIds: string[];
}

export interface ReferenceCoverageSummaryV2 {
  status: "complete" | "partial";
  files: CountSummaryV2;
  functions: CountSummaryV2;
  types: CountSummaryV2;
}

export interface WikiPageV2 {
  id: string;
  title: string;
  summary: string;
  markdownPath: string;
  role: WikiDocumentRole;
  category: WikiDocumentCategory;
  quality: ContentQuality;
  generationStatus: GenerationStatus;
  directNodeIds: string[];
  contextNodeIds: string[];
  evidenceIds: string[];
  searchTerms: string[];
  verification?: { method: "human" | "external"; verifiedAt: string; verifier?: string };
  route?: { order: number; stage: RouteStage };
}

export interface WikiNodeDocumentationV2 {
  nodeId: string;
  relation: DocumentationRelation;
  quality: ContentQuality;
  evidenceHealth: EvidenceHealth;
  generationStatus: GenerationStatus;
  referenceCoverage: ReferenceCoverage;
  directPageIds: string[];
  contextPageIds: string[];
  evidenceIds: string[];
  primaryPageId?: string;
  anchor?: string;
}

export interface WikiEvidenceV2 {
  id: string;
  nodeIds: string[];
  filePath: string;
  lineRange: [number, number];
  excerpt?: string;
  evidenceType: "production" | "configuration" | "test" | "documentation";
}

export interface WikiIndexV2 {
  version: 2;
  generatedAt: string;
  projectName: string;
  source: {
    outputLanguage: string;
    generationMode: string;
    graphDigest?: string;
    gitCommitHash?: string;
    sourceRootIdentity?: string;
  };
  mainReadiness: MainReadinessSummaryV2;
  referenceCoverage: ReferenceCoverageSummaryV2;
  pages: WikiPageV2[];
  nodeDocumentation: WikiNodeDocumentationV2[];
  evidence: WikiEvidenceV2[];
}

export interface WikiSearchRecordV2 {
  id: string;
  kind: "page" | "symbol";
  title: string;
  summary?: string;
  content?: string;
  pageId: string;
  anchor?: string;
  nodeId?: string;
  role: WikiDocumentRole;
  category: WikiDocumentCategory;
  relation: DocumentationRelation;
  terms: string[];
  businessTerms: string[];
  filePath?: string;
}

export interface WikiSearchIndexV2 {
  version: 2;
  generatedAt: string;
  records: WikiSearchRecordV2[];
}

export interface WikiClaimTraceV2 {
  id: string;
  text: string;
  nodeIds: string[];
  evidenceIds: string[];
}

export interface WikiDocumentTraceRecordV2 {
  pageId: string;
  directNodeIds: string[];
  contextNodeIds: string[];
  evidenceIds: string[];
  quality: ContentQuality;
  generationStatus: GenerationStatus;
  issues: string[];
  claims: WikiClaimTraceV2[];
}

export interface WikiDocumentTracesV2 {
  version: 2;
  generatedAt: string;
  traces: WikiDocumentTraceRecordV2[];
}

export interface WikiGenerationReportV2 {
  version: 2;
  generatedAt: string;
  generationMode: string;
  source: {
    outputLanguage: string;
    sourceRootIdentity: string;
    graphDigest?: string;
    gitCommitHash?: string;
  };
  sourceRead: CountSummaryV2;
  mainReadiness: MainReadinessSummaryV2;
  referenceCoverage: ReferenceCoverageSummaryV2;
  warnings: string[];
  errors: string[];
}

export type WikiParseResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; errors: string[] };

export const WikiDocumentRoleSchema = z.enum(["featured", "reference", "maintenance"]);
export const WikiDocumentCategorySchema = z.enum([
  "overview",
  "capability",
  "flow",
  "module",
  "topic",
  "file",
  "quality",
  "coverage",
  "other",
]);
export const DocumentationRelationSchema = z.enum(["direct", "context", "none"]);
export const ContentQualitySchema = z.enum(["verified", "generated", "needs-review", "failed"]);
export const EvidenceHealthSchema = z.enum(["source-linked", "weak", "unreadable", "missing"]);
export const GenerationStatusSchema = z.enum(["complete", "partial", "failed"]);
export const ReferenceCoverageSchema = z.enum(["anchored", "unanchored", "not-applicable"]);
export const MainReadinessSchema = z.enum(["ready", "degraded", "blocked"]);
export const RouteStageSchema = z.enum(["purpose", "flow", "rule", "implementation", "evidence"]);

const CountValueSchema = z.number().int().nonnegative();
const StringArraySchema = z.array(z.string());

export const CountSummaryV2Schema = z.strictObject({
  covered: CountValueSchema,
  total: CountValueSchema,
  missingIds: StringArraySchema,
}) satisfies z.ZodType<CountSummaryV2>;

export const MainReadinessSummaryV2Schema = z.strictObject({
  status: MainReadinessSchema,
  reasons: StringArraySchema,
  routePageIds: StringArraySchema,
}) satisfies z.ZodType<MainReadinessSummaryV2>;

export const ReferenceCoverageSummaryV2Schema = z.strictObject({
  status: z.enum(["complete", "partial"]),
  files: CountSummaryV2Schema,
  functions: CountSummaryV2Schema,
  types: CountSummaryV2Schema,
}) satisfies z.ZodType<ReferenceCoverageSummaryV2>;

const WikiVerificationV2Schema = z.strictObject({
  method: z.enum(["human", "external"]),
  verifiedAt: z.string(),
  verifier: z.string().optional(),
});

const WikiRouteV2Schema = z.strictObject({
  order: z.number(),
  stage: RouteStageSchema,
});

export const WikiPageV2Schema = z.strictObject({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  markdownPath: z.string(),
  role: WikiDocumentRoleSchema,
  category: WikiDocumentCategorySchema,
  quality: ContentQualitySchema,
  generationStatus: GenerationStatusSchema,
  directNodeIds: StringArraySchema,
  contextNodeIds: StringArraySchema,
  evidenceIds: StringArraySchema,
  searchTerms: StringArraySchema,
  verification: WikiVerificationV2Schema.optional(),
  route: WikiRouteV2Schema.optional(),
}) satisfies z.ZodType<WikiPageV2>;

export const WikiNodeDocumentationV2Schema = z.strictObject({
  nodeId: z.string(),
  relation: DocumentationRelationSchema,
  quality: ContentQualitySchema,
  evidenceHealth: EvidenceHealthSchema,
  generationStatus: GenerationStatusSchema,
  referenceCoverage: ReferenceCoverageSchema,
  directPageIds: StringArraySchema,
  contextPageIds: StringArraySchema,
  evidenceIds: StringArraySchema,
  primaryPageId: z.string().optional(),
  anchor: z.string().optional(),
}) satisfies z.ZodType<WikiNodeDocumentationV2>;

const WikiEvidenceStructuralLineRangeV2Schema = z.tuple([z.number(), z.number()]);

export const WikiEvidenceLineRangeV2Schema = WikiEvidenceStructuralLineRangeV2Schema.superRefine(
  ([start, end], context) => {
    if (end < start) {
      context.addIssue({
        code: "custom",
        message: "lineRange end must be greater than or equal to start",
      });
    }
  },
);

const WikiEvidenceStructuralV2Schema = z.strictObject({
  id: z.string(),
  nodeIds: StringArraySchema,
  filePath: z.string(),
  lineRange: WikiEvidenceStructuralLineRangeV2Schema,
  excerpt: z.string().optional(),
  evidenceType: z.enum(["production", "configuration", "test", "documentation"]),
}) satisfies z.ZodType<WikiEvidenceV2>;

export const WikiEvidenceV2Schema = WikiEvidenceStructuralV2Schema.extend({
  lineRange: WikiEvidenceLineRangeV2Schema,
}) satisfies z.ZodType<WikiEvidenceV2>;

const WikiSourceV2Schema = z.strictObject({
  outputLanguage: z.string(),
  generationMode: z.string(),
  graphDigest: z.string().optional(),
  gitCommitHash: z.string().optional(),
  sourceRootIdentity: z.string().optional(),
});

const WikiIndexInvariantInputV2Schema = z.strictObject({
  version: z.literal(2),
  generatedAt: z.string(),
  projectName: z.string(),
  source: WikiSourceV2Schema,
  mainReadiness: MainReadinessSummaryV2Schema,
  referenceCoverage: ReferenceCoverageSummaryV2Schema,
  pages: z.array(WikiPageV2Schema),
  nodeDocumentation: z.array(WikiNodeDocumentationV2Schema),
  evidence: z.array(WikiEvidenceStructuralV2Schema),
}) satisfies z.ZodType<WikiIndexV2>;

export const WikiIndexV2Schema = WikiIndexInvariantInputV2Schema.extend({
  evidence: z.array(WikiEvidenceV2Schema),
}) satisfies z.ZodType<WikiIndexV2>;

function addInvariantError(
  errors: string[],
  path: string,
  message: string,
  diagnostic?: string,
): void {
  const diagnosticSuffix = diagnostic === undefined ? "" : `（${diagnostic}）`;
  errors.push(`${path}：${message}${diagnosticSuffix}`);
}

function validateDuplicateIds(index: WikiIndexV2, errors: string[]): void {
  const pageIds = new Set<string>();
  index.pages.forEach((page, pageIndex) => {
    if (pageIds.has(page.id)) {
      addInvariantError(errors, `pages[${pageIndex}].id`, `页面 ID 重复：${page.id}`, "duplicate page id");
    }
    pageIds.add(page.id);
  });

  const nodeIds = new Set<string>();
  index.nodeDocumentation.forEach((record, recordIndex) => {
    if (nodeIds.has(record.nodeId)) {
      addInvariantError(
        errors,
        `nodeDocumentation[${recordIndex}].nodeId`,
        `节点文档 ID 重复：${record.nodeId}`,
        "duplicate node-documentation node id",
      );
    }
    nodeIds.add(record.nodeId);
  });

  const evidenceIds = new Set<string>();
  index.evidence.forEach((evidence, evidenceIndex) => {
    if (evidenceIds.has(evidence.id)) {
      addInvariantError(
        errors,
        `evidence[${evidenceIndex}].id`,
        `证据 ID 重复：${evidence.id}`,
        "duplicate evidence id",
      );
    }
    evidenceIds.add(evidence.id);
  });
}

function validatePages(index: WikiIndexV2, errors: string[]): void {
  const routeOrders = new Map<number, string>();

  index.pages.forEach((page, pageIndex) => {
    const directNodeIds = new Set(page.directNodeIds);
    const overlappingNodeIds = [...new Set(page.contextNodeIds.filter((nodeId) => directNodeIds.has(nodeId)))];
    if (overlappingNodeIds.length > 0) {
      addInvariantError(
        errors,
        `pages[${pageIndex}]`,
        `directNodeIds 与 contextNodeIds 存在重叠：${overlappingNodeIds.join(", ")}`,
        "directNodeIds and contextNodeIds overlap",
      );
    }

    if (page.quality === "verified" && page.verification === undefined) {
      addInvariantError(
        errors,
        `pages[${pageIndex}].verification`,
        "verified 页面必须提供 verification",
        "verified page requires verification",
      );
    }
    if (page.quality !== "verified" && page.verification !== undefined) {
      addInvariantError(
        errors,
        `pages[${pageIndex}].verification`,
        "只有 verified 页面可以提供 verification",
        "non-verified page must not include verification",
      );
    }

    if (page.route !== undefined) {
      if (page.role !== "featured") {
        addInvariantError(
          errors,
          `pages[${pageIndex}].route`,
          "只有 featured 页面可以配置 route",
          "route requires featured page",
        );
      }

      const previousPageId = routeOrders.get(page.route.order);
      if (previousPageId !== undefined) {
        addInvariantError(
          errors,
          `pages[${pageIndex}].route.order`,
          `route.order 必须唯一，已被 ${previousPageId} 使用：${page.route.order}`,
          "duplicate route order",
        );
      } else {
        routeOrders.set(page.route.order, page.id);
      }
    }
  });
}

function validateRoutePages(index: WikiIndexV2, pagesById: Map<string, WikiPageV2>, errors: string[]): void {
  index.mainReadiness.routePageIds.forEach((pageId, routeIndex) => {
    const page = pagesById.get(pageId);
    if (page === undefined) {
      addInvariantError(
        errors,
        `mainReadiness.routePageIds[${routeIndex}]`,
        `路由页面不存在：${pageId}`,
        "missing route page",
      );
      return;
    }
    if (page.role !== "featured") {
      addInvariantError(
        errors,
        `mainReadiness.routePageIds[${routeIndex}]`,
        `路由页面必须是 featured：${pageId}`,
        "route page must be featured",
      );
    }
    if (page.route === undefined) {
      addInvariantError(
        errors,
        `mainReadiness.routePageIds[${routeIndex}]`,
        `路由页面必须配置 route：${pageId}`,
        "route page must define route",
      );
    }
  });
}

function validateEvidenceReferences(
  index: WikiIndexV2,
  evidenceById: Map<string, WikiEvidenceV2>,
  errors: string[],
): void {
  index.pages.forEach((page, pageIndex) => {
    page.evidenceIds.forEach((evidenceId, evidenceIndex) => {
      if (!evidenceById.has(evidenceId)) {
        addInvariantError(
          errors,
          `pages[${pageIndex}].evidenceIds[${evidenceIndex}]`,
          `页面引用的证据不存在：${evidenceId}`,
          "missing page evidence",
        );
      }
    });
  });

  index.nodeDocumentation.forEach((record, recordIndex) => {
    record.evidenceIds.forEach((evidenceId, evidenceIndex) => {
      if (!evidenceById.has(evidenceId)) {
        addInvariantError(
          errors,
          `nodeDocumentation[${recordIndex}].evidenceIds[${evidenceIndex}]`,
          `节点引用的证据不存在：${evidenceId}`,
          "missing node evidence",
        );
      }
    });
  });
}

function validateNodePageReferences(
  index: WikiIndexV2,
  pagesById: Map<string, WikiPageV2>,
  errors: string[],
): void {
  index.nodeDocumentation.forEach((record, recordIndex) => {
    record.directPageIds.forEach((pageId, pageIndex) => {
      const page = pagesById.get(pageId);
      if (page === undefined) {
        addInvariantError(
          errors,
          `nodeDocumentation[${recordIndex}].directPageIds[${pageIndex}]`,
          `直接页面不存在：${pageId}`,
          "missing direct page",
        );
      } else if (!page.directNodeIds.includes(record.nodeId)) {
        addInvariantError(
          errors,
          `nodeDocumentation[${recordIndex}].directPageIds[${pageIndex}]`,
          `直接页面未在 directNodeIds 中包含节点 ${record.nodeId}：${pageId}`,
          "direct page does not contain node",
        );
      }
    });

    record.contextPageIds.forEach((pageId, pageIndex) => {
      const page = pagesById.get(pageId);
      if (page === undefined) {
        addInvariantError(
          errors,
          `nodeDocumentation[${recordIndex}].contextPageIds[${pageIndex}]`,
          `上下文页面不存在：${pageId}`,
          "missing context page",
        );
      } else if (!page.contextNodeIds.includes(record.nodeId)) {
        addInvariantError(
          errors,
          `nodeDocumentation[${recordIndex}].contextPageIds[${pageIndex}]`,
          `上下文页面未在 contextNodeIds 中包含节点 ${record.nodeId}：${pageId}`,
          "context page does not contain node",
        );
      }
    });

    if (record.primaryPageId !== undefined && !record.directPageIds.includes(record.primaryPageId)) {
      addInvariantError(
        errors,
        `nodeDocumentation[${recordIndex}].primaryPageId`,
        `primaryPageId 必须引用直接页面：${record.primaryPageId}`,
        "primaryPageId must reference a direct page",
      );
    }
  });
}

function validateNodeEvidence(
  index: WikiIndexV2,
  evidenceById: Map<string, WikiEvidenceV2>,
  errors: string[],
): void {
  index.nodeDocumentation.forEach((record, recordIndex) => {
    record.evidenceIds.forEach((evidenceId, evidenceIndex) => {
      const evidence = evidenceById.get(evidenceId);
      if (evidence !== undefined && !evidence.nodeIds.includes(record.nodeId)) {
        addInvariantError(
          errors,
          `nodeDocumentation[${recordIndex}].evidenceIds[${evidenceIndex}]`,
          `证据 ${evidenceId} 未包含节点 ${record.nodeId}`,
          "evidence does not contain node",
        );
      }
    });

    if (record.evidenceHealth === "source-linked") {
      const hasSourceLinkedEvidence = record.evidenceIds.some((evidenceId) => {
        const evidence = evidenceById.get(evidenceId);
        return evidence !== undefined
          && evidence.nodeIds.includes(record.nodeId)
          && evidence.excerpt !== undefined
          && evidence.excerpt.trim().length > 0;
      });
      if (!hasSourceLinkedEvidence) {
        addInvariantError(
          errors,
          `nodeDocumentation[${recordIndex}].evidenceHealth`,
          "source-linked 节点必须具有包含该节点且 excerpt 非空的证据",
          "source-linked requires exact node evidence with non-empty excerpt",
        );
      }
    }
  });
}

function validateCompletePageEvidence(
  index: WikiIndexV2,
  evidenceById: Map<string, WikiEvidenceV2>,
  errors: string[],
): void {
  index.pages.forEach((page, pageIndex) => {
    const requiresCompleteEvidence = page.generationStatus === "complete"
      && (page.quality === "generated" || page.quality === "verified");
    if (!requiresCompleteEvidence) return;

    const evidencedNodeIds = new Set<string>();
    page.evidenceIds.forEach((evidenceId) => {
      evidenceById.get(evidenceId)?.nodeIds.forEach((nodeId) => evidencedNodeIds.add(nodeId));
    });
    page.directNodeIds.forEach((nodeId) => {
      if (!evidencedNodeIds.has(nodeId)) {
        addInvariantError(
          errors,
          `pages[${pageIndex}].evidenceIds`,
          `完整的 generated/verified 页面缺少直接节点证据：${nodeId}`,
          "complete page evidence must cover every direct node",
        );
      }
    });
  });
}

function validateDocumentationRelations(index: WikiIndexV2, errors: string[]): void {
  index.nodeDocumentation.forEach((record, recordIndex) => {
    const expectedRelation: DocumentationRelation = record.directPageIds.length > 0
      ? "direct"
      : record.contextPageIds.length > 0
        ? "context"
        : "none";
    if (record.relation !== expectedRelation) {
      addInvariantError(
        errors,
        `nodeDocumentation[${recordIndex}].relation`,
        `relation 应为 ${expectedRelation}，实际为 ${record.relation}`,
        "relation must match page arrays",
      );
    }
  });
}

function validateCountSummary(summary: CountSummaryV2, path: string, errors: string[]): void {
  if (summary.covered > summary.total) {
    addInvariantError(errors, path, "covered 不能大于 total", "covered must not exceed total");
  }

  if (summary.missingIds.length !== summary.total - summary.covered) {
    addInvariantError(
      errors,
      `${path}.missingIds`,
      "missingIds 数量必须等于 total - covered",
      "missingIds length must equal total minus covered",
    );
  }

  if (new Set(summary.missingIds).size !== summary.missingIds.length) {
    addInvariantError(errors, `${path}.missingIds`, "missingIds 不能包含重复 ID", "missingIds must be unique");
  }
}

function validateCountSummaries(index: WikiIndexV2, errors: string[]): void {
  validateCountSummary(index.referenceCoverage.files, "referenceCoverage.files", errors);
  validateCountSummary(index.referenceCoverage.functions, "referenceCoverage.functions", errors);
  validateCountSummary(index.referenceCoverage.types, "referenceCoverage.types", errors);
}

function validateWikiIndexInvariants(index: WikiIndexV2, existingErrors: string[] = []): string[] {
  const errors = existingErrors;
  const pagesById = new Map(index.pages.map((page) => [page.id, page]));
  const evidenceById = new Map(index.evidence.map((evidence) => [evidence.id, evidence]));

  validateDuplicateIds(index, errors);
  validatePages(index, errors);
  validateRoutePages(index, pagesById, errors);
  validateEvidenceReferences(index, evidenceById, errors);
  validateNodePageReferences(index, pagesById, errors);
  validateNodeEvidence(index, evidenceById, errors);
  validateCompletePageEvidence(index, evidenceById, errors);
  validateDocumentationRelations(index, errors);
  validateCountSummaries(index, errors);

  return errors;
}

function formatSchemaErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map((segment) => String(segment)).join(".");
    const prefix = path.length === 0 ? "" : `${path}：`;
    if (issue.message === "lineRange end must be greater than or equal to start") {
      return `${prefix}lineRange 的结束行必须大于或等于起始行（${issue.message}）`;
    }

    switch (issue.code) {
      case "invalid_type":
        return `${prefix}字段类型不正确`;
      case "invalid_value":
        return `${prefix}字段值不在允许范围内`;
      case "too_small":
        return `${prefix}字段值小于允许下限`;
      case "too_big":
        return `${prefix}字段值大于允许上限`;
      case "invalid_format":
        return `${prefix}字段格式不正确`;
      case "not_multiple_of":
        return `${prefix}字段值不是允许的倍数`;
      case "unrecognized_keys":
        return `${prefix}包含 Wiki V2 契约未声明的字段`;
      case "invalid_union":
        return `${prefix}字段值不符合任一允许结构`;
      case "invalid_key":
        return `${prefix}对象键不符合契约`;
      case "invalid_element":
        return `${prefix}集合元素不符合契约`;
      case "custom":
        return `${prefix}字段值不符合契约约束`;
      default:
        return `${prefix}字段值不符合 Wiki V2 契约`;
    }
  });
}

export function parseWikiIndexV2(value: unknown): WikiParseResult<WikiIndexV2> {
  const parsed = WikiIndexV2Schema.safeParse(value);
  if (parsed.success) {
    const errors = validateWikiIndexInvariants(parsed.data);
    return errors.length === 0
      ? { ok: true, value: parsed.data, errors: [] }
      : { ok: false, errors };
  }

  const errors = formatSchemaErrors(parsed.error);
  const invariantInput = WikiIndexInvariantInputV2Schema.safeParse(value);
  if (invariantInput.success) {
    validateWikiIndexInvariants(invariantInput.data, errors);
  }
  return { ok: false, errors };
}

interface WikiIndexLookups {
  pagesById: Map<string, WikiPageV2>;
  nodeDocumentationById: Map<string, WikiNodeDocumentationV2>;
  evidenceById: Map<string, WikiEvidenceV2>;
}

function buildWikiIndexLookups(index: WikiIndexV2): WikiIndexLookups {
  return {
    pagesById: new Map(index.pages.map((page) => [page.id, page])),
    nodeDocumentationById: new Map(index.nodeDocumentation.map((record) => [record.nodeId, record])),
    evidenceById: new Map(index.evidence.map((evidence) => [evidence.id, evidence])),
  };
}

export function directPagesForNode(index: WikiIndexV2, nodeId: string): WikiPageV2[] {
  const lookups = buildWikiIndexLookups(index);
  const pageIds = lookups.nodeDocumentationById.get(nodeId)?.directPageIds ?? [];
  return pageIds.flatMap((pageId) => {
    const page = lookups.pagesById.get(pageId);
    return page === undefined ? [] : [page];
  });
}

export function contextPagesForNode(index: WikiIndexV2, nodeId: string): WikiPageV2[] {
  const lookups = buildWikiIndexLookups(index);
  const pageIds = lookups.nodeDocumentationById.get(nodeId)?.contextPageIds ?? [];
  return pageIds.flatMap((pageId) => {
    const page = lookups.pagesById.get(pageId);
    return page === undefined ? [] : [page];
  });
}

export function evidenceForNode(index: WikiIndexV2, nodeId: string): WikiEvidenceV2[] {
  const lookups = buildWikiIndexLookups(index);
  const evidenceIds = lookups.nodeDocumentationById.get(nodeId)?.evidenceIds ?? [];
  return evidenceIds.flatMap((evidenceId) => {
    const evidence = lookups.evidenceById.get(evidenceId);
    return evidence === undefined ? [] : [evidence];
  });
}

export function primaryDestinationForNode(
  index: WikiIndexV2,
  nodeId: string,
): { pageId: string; anchor?: string } | undefined {
  const record = buildWikiIndexLookups(index).nodeDocumentationById.get(nodeId);
  if (record?.primaryPageId === undefined) return undefined;
  return record.anchor === undefined
    ? { pageId: record.primaryPageId }
    : { pageId: record.primaryPageId, anchor: record.anchor };
}
