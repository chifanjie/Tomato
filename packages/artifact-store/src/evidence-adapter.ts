import { TextDecoder } from "node:util";

import {
  ClaimV1Schema,
  ContentDigestSchema,
  EvidenceV1Schema,
  IsoTimestampSchema,
  RepositoryRelativePathSchema,
  SnapshotIdSchema,
  TaskIdSchema,
  type ClaimV1,
  type ContentDigest,
  type EvidenceFreshnessV1,
  type EvidenceV1,
} from "@understand-code/contracts";

import { sha256Bytes } from "./digest.js";
import { ArtifactStoreError } from "./errors.js";

export interface WikiEvidenceV2Input {
  id: string;
  nodeIds: string[];
  filePath: string;
  lineRange: [number, number];
  excerpt?: string;
  evidenceType: "production" | "configuration" | "test" | "documentation";
}

export interface WikiPageV2Input {
  id: string;
  directNodeIds: string[];
  contextNodeIds: string[];
  evidenceIds: string[];
  quality: "verified" | "generated" | "needs-review" | "failed";
  generationStatus: "complete" | "partial" | "failed";
}

export interface WikiNodeDocumentationV2Input {
  nodeId: string;
  directPageIds: string[];
  contextPageIds: string[];
  evidenceIds: string[];
}

export interface WikiIndexV2EvidenceInput {
  version: 2;
  generatedAt: string;
  evidence: WikiEvidenceV2Input[];
  pages: WikiPageV2Input[];
  nodeDocumentation: WikiNodeDocumentationV2Input[];
}

export interface WikiClaimTraceV2Input {
  id: string;
  text: string;
  nodeIds: string[];
  evidenceIds: string[];
}

export interface WikiDocumentTraceRecordV2Input {
  pageId: string;
  directNodeIds: string[];
  contextNodeIds: string[];
  evidenceIds: string[];
  quality: "verified" | "generated" | "needs-review" | "failed";
  generationStatus: "complete" | "partial" | "failed";
  claims: WikiClaimTraceV2Input[];
}

export interface WikiDocumentTracesV2Input {
  version: 2;
  generatedAt: string;
  traces: WikiDocumentTraceRecordV2Input[];
}

export interface WikiV2EvidenceAdapterOptions {
  taskId: string;
  sourceSnapshotId: string;
  producedBy: string;
  createdAt: string;
  sourceContents: Readonly<Record<string, string | Uint8Array>>;
  sourceContentDigests?: Readonly<Record<string, ContentDigest>>;
}

export interface WikiV2EvidenceAdapterResult {
  claims: ClaimV1[];
  evidence: EvidenceV1[];
  claimIdByLegacyTraceClaim: Readonly<Record<string, string>>;
  evidenceIdByLegacyId: Readonly<Record<string, string>>;
}

function stableId(prefix: string, legacyId: string): string {
  const direct = `${prefix}:${legacyId}`;
  return direct.length <= 256
    ? direct
    : `${prefix}:${sha256Bytes(legacyId).slice("sha256:".length)}`;
}

function mapEvidenceKind(
  kind: WikiEvidenceV2Input["evidenceType"],
): "source" | "config" | "test" | "document" {
  switch (kind) {
    case "production":
      return "source";
    case "configuration":
      return "config";
    case "test":
      return "test";
    case "documentation":
      return "document";
  }
}

function decodeEvidenceSourceContent(
  content: string | Uint8Array,
  evidenceId: string,
): string {
  if (typeof content === "string") return content;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch (error) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      `Wiki Evidence source content is not valid UTF-8: ${evidenceId}.`,
      { evidenceId },
      { cause: error },
    );
  }
}

function normalizeSourceNewlines(value: string): string {
  return value.replace(/\r\n?|\n/gu, "\n");
}

const CREDENTIAL_ASSIGNMENT_PATTERN =
  /(["']?)(password|passwd|pwd|cookie|set[_-]?cookie|client[_-]?secret|consumer[_-]?secret|webhook[_-]?secret|session[_-]?secret|aws[_-]?secret[_-]?access[_-]?key|aws[_-]?access[_-]?key[_-]?id|secret[_-]?access[_-]?key|secret[_-]?key|signing[_-]?key|encryption[_-]?key|secret|api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|github[_-]?token|private[_-]?key|authorization|database[_-]?url|connection[_-]?string)\1(\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}\]]+)/giu;

const SENSITIVE_SOURCE_COMPONENTS = new Set([
  ".netrc",
  ".npmrc",
  ".pypirc",
  "application_default_credentials.json",
]);

const SENSITIVE_SOURCE_EXTENSIONS = [
  ".key",
  ".p12",
  ".pem",
  ".pfx",
];

function assertEvidenceSourcePathAllowed(filePath: string): void {
  const components = filePath.split("/");
  for (const [index, component] of components.entries()) {
    const lower = component.toLowerCase();
    if (
      SENSITIVE_SOURCE_COMPONENTS.has(lower) ||
      lower === ".env" ||
      lower.startsWith(".env.") ||
      /^id_(?:ed25519|rsa)(?:\..*)?$/u.test(lower) ||
      (lower === ".aws" &&
        components[index + 1]?.toLowerCase() === "credentials") ||
      SENSITIVE_SOURCE_EXTENSIONS.some((extension) =>
        lower.endsWith(extension),
      )
    ) {
      throw new ArtifactStoreError(
        "sensitive_path",
        `Wiki Evidence cannot read sensitive source path component "${component}".`,
        { filePath },
      );
    }
  }
}

function looksLikeConservativeHighEntropyToken(candidate: string): boolean {
  if (
    candidate.length < 32 ||
    candidate.length > 4096 ||
    /^(?:sha(?:1|224|256|384|512)[-:]?)?[a-f0-9]{32,}$/iu.test(candidate) ||
    /^sha(?:256|384|512)-[A-Za-z0-9+/=]+$/u.test(candidate)
  ) {
    return false;
  }

  const characterClasses = [
    /[a-z]/u,
    /[A-Z]/u,
    /[0-9]/u,
    /[+/_=-]/u,
  ].filter((pattern) => pattern.test(candidate)).length;
  if (characterClasses < 3) return false;

  const frequencies = new Map<string, number>();
  for (const character of candidate) {
    frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
  }
  const entropy = [...frequencies.values()].reduce((total, count) => {
    const probability = count / candidate.length;
    return total - probability * Math.log2(probability);
  }, 0);
  return entropy >= 3.75;
}

function redactConservativeHighEntropyTokens(value: string): string {
  return value.replace(/[A-Za-z0-9+/_-]{32,}={0,2}/gu, (candidate) =>
    looksLikeConservativeHighEntropyToken(candidate)
      ? "[REDACTED_HIGH_ENTROPY_TOKEN]"
      : candidate,
  );
}

export function sanitizeEvidenceExcerpt(excerpt: string): string {
  const sanitized = excerpt
    .replace(
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/giu,
      "[REDACTED_PRIVATE_KEY]",
    )
    .replace(
      /(^|[\s"'`])([ \t]*(?:Set-Cookie|Cookie)\s*:\s*)[^\r\n"'`]*/gimu,
      (_match, boundary: string, header: string) =>
        `${boundary}${header}[REDACTED]`,
    )
    .replace(
      /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/giu,
      (_match, scheme: string) => `${scheme} [REDACTED]`,
    )
    .replace(
      /\b([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^@\s/]+)@/giu,
      (_match, scheme: string, user: string) =>
        `${scheme}${user}:[REDACTED]@`,
    )
    .replace(
      /(^|[\s"'`])(--?(?:password|passwd|token|secret|api-key|client-secret))(?:=|\s+)([^\s"'`]+)/gimu,
      (_match, boundary: string, flag: string) =>
        `${boundary}${flag}=[REDACTED]`,
    )
    .replace(
      CREDENTIAL_ASSIGNMENT_PATTERN,
      (
        _match,
        keyQuote: string,
        key: string,
        separator: string,
        value: string,
      ) => {
        const valueQuote =
          value.startsWith('"') ? '"' : value.startsWith("'") ? "'" : "";
        return `${keyQuote}${key}${keyQuote}${separator}${valueQuote}[REDACTED]${valueQuote}`;
      },
    )
    .replace(
      /\bAKIA[0-9A-Z]{16}\b/gu,
      "[REDACTED_AWS_ACCESS_KEY]",
    )
    .replace(
      /\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu,
      "[REDACTED_GITHUB_TOKEN]",
    )
    .replace(
      /\bglpat-[A-Za-z0-9_-]{20,}\b/gu,
      "[REDACTED_GITLAB_TOKEN]",
    )
    .replace(
      /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/gu,
      "[REDACTED_API_TOKEN]",
    )
    .replace(
      /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/gu,
      "[REDACTED_SLACK_TOKEN]",
    );
  return redactConservativeHighEntropyTokens(sanitized);
}

function validateLegacyReferenceSet(
  ids: readonly string[],
  evidenceByLegacyId: ReadonlyMap<string, WikiEvidenceV2Input>,
  location: string,
): void {
  for (const evidenceId of ids) {
    if (!evidenceByLegacyId.has(evidenceId)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki V2 contains a dangling Evidence reference at ${location}.`,
        { evidenceId, location },
      );
    }
  }
}

function assertLegacyIdentifier(value: unknown, location: string): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value !== value.trim()
  ) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      `Wiki V2 contains an invalid identifier at ${location}.`,
      { location },
    );
  }
  return value;
}

function validateLegacyIdentifierArray(
  value: unknown,
  location: string,
): string[] {
  if (!Array.isArray(value)) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      `Wiki V2 is missing required identifier metadata at ${location}.`,
      { location },
    );
  }
  const result = value.map((item, index) =>
    assertLegacyIdentifier(item, `${location}[${index}]`),
  );
  if (new Set(result).size !== result.length) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      `Wiki V2 contains duplicate identifiers at ${location}.`,
      { location },
    );
  }
  return result;
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

const WIKI_CONTENT_QUALITIES = new Set([
  "verified",
  "generated",
  "needs-review",
  "failed",
]);
const WIKI_GENERATION_STATUSES = new Set(["complete", "partial", "failed"]);

function validateWikiV2CrossArtifactRelations(
  wikiIndex: WikiIndexV2EvidenceInput,
  documentTraces: WikiDocumentTracesV2Input,
  evidenceByLegacyId: ReadonlyMap<string, WikiEvidenceV2Input>,
): void {
  if (!Array.isArray(wikiIndex.pages)) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      "Wiki V2 page metadata is required for Evidence adaptation.",
    );
  }
  if (!Array.isArray(documentTraces.traces)) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      "Wiki V2 document trace metadata is required for Evidence adaptation.",
    );
  }

  const pageById = new Map<string, WikiPageV2Input>();
  wikiIndex.pages.forEach((page, pageIndex) => {
    const location = `pages[${pageIndex}]`;
    const pageId = assertLegacyIdentifier(page?.id, `${location}.id`);
    if (pageById.has(pageId)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Duplicate Wiki Page ID: ${pageId}`,
      );
    }
    const directNodeIds = validateLegacyIdentifierArray(
      page?.directNodeIds,
      `${location}.directNodeIds`,
    );
    const contextNodeIds = validateLegacyIdentifierArray(
      page?.contextNodeIds,
      `${location}.contextNodeIds`,
    );
    const evidenceIds = validateLegacyIdentifierArray(
      page?.evidenceIds,
      `${location}.evidenceIds`,
    );
    if (
      directNodeIds.some((nodeId) => contextNodeIds.includes(nodeId))
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki Page ${pageId} lists a node as both direct and context.`,
      );
    }
    if (
      !WIKI_CONTENT_QUALITIES.has(page?.quality) ||
      !WIKI_GENERATION_STATUSES.has(page?.generationStatus)
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki Page ${pageId} is missing required quality metadata.`,
      );
    }
    validateLegacyReferenceSet(
      evidenceIds,
      evidenceByLegacyId,
      `${location}.evidenceIds`,
    );
    pageById.set(pageId, page);
  });

  const tracePageIds = new Set<string>();
  documentTraces.traces.forEach((trace, traceIndex) => {
    const location = `traces[${traceIndex}]`;
    const pageId = assertLegacyIdentifier(trace?.pageId, `${location}.pageId`);
    if (tracePageIds.has(pageId)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki V2 contains more than one Trace for Page ${pageId}.`,
      );
    }
    tracePageIds.add(pageId);
    const page = pageById.get(pageId);
    if (page === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki V2 Trace references missing Page ${pageId}.`,
      );
    }
    const directNodeIds = validateLegacyIdentifierArray(
      trace?.directNodeIds,
      `${location}.directNodeIds`,
    );
    const contextNodeIds = validateLegacyIdentifierArray(
      trace?.contextNodeIds,
      `${location}.contextNodeIds`,
    );
    const evidenceIds = validateLegacyIdentifierArray(
      trace?.evidenceIds,
      `${location}.evidenceIds`,
    );
    if (
      !sameStringArray(directNodeIds, page.directNodeIds) ||
      !sameStringArray(contextNodeIds, page.contextNodeIds) ||
      !sameStringArray(evidenceIds, page.evidenceIds) ||
      trace.quality !== page.quality ||
      trace.generationStatus !== page.generationStatus
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki V2 Trace metadata does not match Page ${pageId}.`,
      );
    }
    validateLegacyReferenceSet(
      evidenceIds,
      evidenceByLegacyId,
      `${location}.evidenceIds`,
    );
    if (!Array.isArray(trace.claims)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki V2 Trace ${pageId} is missing Claim metadata.`,
      );
    }
    const traceEvidenceIds = new Set(evidenceIds);
    const pageNodeIds = new Set([...directNodeIds, ...contextNodeIds]);
    const claimIds = new Set<string>();
    trace.claims.forEach((claim, claimIndex) => {
      const claimLocation = `${location}.claims[${claimIndex}]`;
      const claimId = assertLegacyIdentifier(claim?.id, `${claimLocation}.id`);
      if (claimIds.has(claimId)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Trace ${pageId} contains duplicate Claim ID ${claimId}.`,
        );
      }
      claimIds.add(claimId);
      if (
        typeof claim?.text !== "string" ||
        claim.text.trim().length === 0
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Claim at ${claimLocation} must contain a non-empty statement.`,
        );
      }
      const claimNodeIds = validateLegacyIdentifierArray(
        claim?.nodeIds,
        `${claimLocation}.nodeIds`,
      );
      const claimEvidenceIds = validateLegacyIdentifierArray(
        claim?.evidenceIds,
        `${claimLocation}.evidenceIds`,
      );
      if (claimNodeIds.length === 0) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Claim at ${claimLocation} must identify at least one Page node.`,
        );
      }
      if (claimEvidenceIds.length === 0) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Claim at ${claimLocation} must be backed by Page Evidence.`,
        );
      }
      validateLegacyReferenceSet(
        claimEvidenceIds,
        evidenceByLegacyId,
        `${claimLocation}.evidenceIds`,
      );
      if (
        claimEvidenceIds.some(
          (evidenceId) => !traceEvidenceIds.has(evidenceId),
        )
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Claim at ${claimLocation} references Evidence outside its Page Trace.`,
        );
      }
      const evidencedNodeIds = new Set(
        claimEvidenceIds.flatMap(
          (evidenceId) => evidenceByLegacyId.get(evidenceId)?.nodeIds ?? [],
        ),
      );
      if (
        claimNodeIds.some(
          (nodeId) =>
            !pageNodeIds.has(nodeId) ||
            (claimEvidenceIds.length > 0 && !evidencedNodeIds.has(nodeId)),
        )
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Claim at ${claimLocation} is not supported by matching Page and Evidence nodes.`,
        );
      }
    });
    if (
      page.generationStatus === "complete" &&
      (page.quality === "generated" || page.quality === "verified") &&
      pageNodeIds.size > 0 &&
      !trace.claims.some((claim) => claim.evidenceIds.length > 0)
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Complete Wiki Page ${pageId} must contain at least one Evidence-backed Claim.`,
      );
    }
  });

  if (
    tracePageIds.size !== pageById.size ||
    [...pageById.keys()].some((pageId) => !tracePageIds.has(pageId))
  ) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      "Wiki V2 must contain exactly one Document Trace for every Page.",
    );
  }

  if (!Array.isArray(wikiIndex.nodeDocumentation)) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      "Wiki V2 nodeDocumentation metadata is required and must be an array.",
    );
  }
  const nodeDocumentationById = new Map<
    string,
    WikiNodeDocumentationV2Input
  >();
  wikiIndex.nodeDocumentation.forEach((record, recordIndex) => {
    const location = `nodeDocumentation[${recordIndex}]`;
    const nodeId = assertLegacyIdentifier(record?.nodeId, `${location}.nodeId`);
    if (nodeDocumentationById.has(nodeId)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Duplicate Wiki Node Documentation ID: ${nodeId}`,
      );
    }
    const directPageIds = validateLegacyIdentifierArray(
      record?.directPageIds,
      `${location}.directPageIds`,
    );
    const contextPageIds = validateLegacyIdentifierArray(
      record?.contextPageIds,
      `${location}.contextPageIds`,
    );
    const evidenceIds = validateLegacyIdentifierArray(
      record?.evidenceIds,
      `${location}.evidenceIds`,
    );
    if (
      directPageIds.some((pageId) => contextPageIds.includes(pageId))
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki Node ${nodeId} lists a Page as both direct and context.`,
      );
    }
    validateLegacyReferenceSet(
      evidenceIds,
      evidenceByLegacyId,
      `${location}.evidenceIds`,
    );
    for (const pageId of directPageIds) {
      if (!pageById.get(pageId)?.directNodeIds.includes(nodeId)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Node ${nodeId} has an invalid direct Page reference ${pageId}.`,
        );
      }
    }
    for (const pageId of contextPageIds) {
      if (!pageById.get(pageId)?.contextNodeIds.includes(nodeId)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Node ${nodeId} has an invalid context Page reference ${pageId}.`,
        );
      }
    }
    for (const evidenceId of evidenceIds) {
      if (!evidenceByLegacyId.get(evidenceId)?.nodeIds.includes(nodeId)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Node ${nodeId} has an Evidence reference that does not contain the node.`,
          { evidenceId },
        );
      }
    }
    nodeDocumentationById.set(nodeId, record);
  });
  for (const page of pageById.values()) {
    for (const nodeId of page.directNodeIds) {
      if (!nodeDocumentationById.get(nodeId)?.directPageIds.includes(page.id)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Page ${page.id} and direct Node ${nodeId} are not linked symmetrically.`,
        );
      }
    }
    for (const nodeId of page.contextNodeIds) {
      if (
        !nodeDocumentationById.get(nodeId)?.contextPageIds.includes(page.id)
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Page ${page.id} and context Node ${nodeId} are not linked symmetrically.`,
        );
      }
    }
  }

  const referencedNodeLocations = new Map<string, string>();
  const rememberNode = (nodeId: string, location: string): void => {
    if (!referencedNodeLocations.has(nodeId)) {
      referencedNodeLocations.set(nodeId, location);
    }
  };
  wikiIndex.pages.forEach((page, pageIndex) => {
    const pageNodeIds = new Set([
      ...page.directNodeIds,
      ...page.contextNodeIds,
    ]);
    page.directNodeIds.forEach((nodeId) =>
      rememberNode(nodeId, `pages[${pageIndex}].directNodeIds`),
    );
    page.contextNodeIds.forEach((nodeId) =>
      rememberNode(nodeId, `pages[${pageIndex}].contextNodeIds`),
    );

    for (const evidenceId of page.evidenceIds) {
      const pageEvidence = evidenceByLegacyId.get(evidenceId);
      if (
        pageNodeIds.size > 0 &&
        pageEvidence !== undefined &&
        !pageEvidence.nodeIds.some((nodeId) => pageNodeIds.has(nodeId))
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Page ${page.id} references Evidence ${evidenceId} for unrelated nodes.`,
        );
      }
    }

    if (
      page.generationStatus === "complete" &&
      (page.quality === "generated" || page.quality === "verified")
    ) {
      const evidencedNodeIds = new Set(
        page.evidenceIds.flatMap(
          (evidenceId) => evidenceByLegacyId.get(evidenceId)?.nodeIds ?? [],
        ),
      );
      for (const nodeId of page.directNodeIds) {
        if (!evidencedNodeIds.has(nodeId)) {
          throw new ArtifactStoreError(
            "reference_integrity_failed",
            `Complete Wiki Page ${page.id} is missing Page Evidence for direct Node ${nodeId}.`,
          );
        }
      }
    }
  });
  wikiIndex.evidence.forEach((item, evidenceIndex) => {
    item.nodeIds.forEach((nodeId) => {
      rememberNode(nodeId, `evidence[${evidenceIndex}].nodeIds`);
      const documentation = nodeDocumentationById.get(nodeId);
      if (documentation === undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Evidence ${item.id} references Node ${nodeId} without nodeDocumentation.`,
          { nodeId, location: `evidence[${evidenceIndex}].nodeIds` },
        );
      }
      if (!documentation.evidenceIds.includes(item.id)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Evidence ${item.id} and Node ${nodeId} are not linked symmetrically.`,
        );
      }
    });
  });
  documentTraces.traces.forEach((trace, traceIndex) => {
    trace.claims.forEach((claim, claimIndex) => {
      claim.nodeIds.forEach((nodeId) =>
        rememberNode(
          nodeId,
          `traces[${traceIndex}].claims[${claimIndex}].nodeIds`,
        ),
      );
    });
  });
  for (const [nodeId, location] of referencedNodeLocations) {
    if (!nodeDocumentationById.has(nodeId)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki V2 referenced Node ${nodeId} has no nodeDocumentation record.`,
        { nodeId, location },
      );
    }
  }
}

export function validateClaimEvidenceLinks(
  claims: readonly ClaimV1[],
  evidence: readonly EvidenceV1[],
): void {
  const claimById = new Map<string, ClaimV1>();
  const evidenceById = new Map<string, EvidenceV1>();
  for (const claim of claims) {
    if (claimById.has(claim.id)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Duplicate Claim ID: ${claim.id}`,
      );
    }
    claimById.set(claim.id, claim);
  }
  for (const item of evidence) {
    if (evidenceById.has(item.id)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Duplicate Evidence ID: ${item.id}`,
      );
    }
    evidenceById.set(item.id, item);
  }

  for (const claim of claims) {
    for (const evidenceId of claim.evidenceIds) {
      const linked = evidenceById.get(evidenceId);
      if (linked === undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Claim ${claim.id} references missing Evidence ${evidenceId}.`,
        );
      }
      if (!linked.claimIds.includes(claim.id)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Claim/Evidence link is not symmetric for ${claim.id}/${evidenceId}.`,
        );
      }
    }
  }
  for (const item of evidence) {
    for (const claimId of item.claimIds) {
      const linked = claimById.get(claimId);
      if (linked === undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Evidence ${item.id} references missing Claim ${claimId}.`,
        );
      }
      if (!linked.evidenceIds.includes(item.id)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Evidence/Claim link is not symmetric for ${item.id}/${claimId}.`,
        );
      }
    }
  }
}

export function adaptWikiV2EvidenceAndClaims(
  wikiIndex: WikiIndexV2EvidenceInput,
  documentTraces: WikiDocumentTracesV2Input,
  options: WikiV2EvidenceAdapterOptions,
): WikiV2EvidenceAdapterResult {
  if (wikiIndex.version !== 2 || documentTraces.version !== 2) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      "Only Wiki V2 evidence and document traces can be adapted.",
    );
  }
  const wikiGeneratedAt = IsoTimestampSchema.parse(wikiIndex.generatedAt);
  const tracesGeneratedAt = IsoTimestampSchema.parse(documentTraces.generatedAt);
  if (wikiGeneratedAt !== tracesGeneratedAt) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      "Wiki V2 index and document traces belong to different generation runs.",
      { wikiGeneratedAt, tracesGeneratedAt },
    );
  }
  const taskId = TaskIdSchema.parse(options.taskId);
  const sourceSnapshotId = SnapshotIdSchema.parse(options.sourceSnapshotId);
  const createdAt = IsoTimestampSchema.parse(options.createdAt);
  if (!Array.isArray(wikiIndex.evidence)) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      "Wiki V2 Evidence metadata must be an array.",
    );
  }
  const evidenceByLegacyId = new Map<string, WikiEvidenceV2Input>();
  wikiIndex.evidence.forEach((item, evidenceIndex) => {
    const evidenceId = assertLegacyIdentifier(
      item?.id,
      `evidence[${evidenceIndex}].id`,
    );
    validateLegacyIdentifierArray(
      item?.nodeIds,
      `evidence[${evidenceIndex}].nodeIds`,
    );
    if (evidenceByLegacyId.has(evidenceId)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Duplicate Wiki Evidence ID: ${evidenceId}`,
      );
    }
    evidenceByLegacyId.set(evidenceId, item);
  });
  validateWikiV2CrossArtifactRelations(
    wikiIndex,
    documentTraces,
    evidenceByLegacyId,
  );

  const evidenceIdByLegacyId: Record<string, string> = {};
  const claimIdByLegacyTraceClaim: Record<string, string> = {};
  const claimIdsByEvidenceId = new Map<string, Set<string>>();
  const claims: ClaimV1[] = [];
  const claimIds = new Set<string>();

  documentTraces.traces.forEach((trace, traceIndex) => {
    validateLegacyReferenceSet(
      trace.evidenceIds,
      evidenceByLegacyId,
      `traces[${traceIndex}].evidenceIds`,
    );
    trace.claims.forEach((legacyClaim, claimIndex) => {
      validateLegacyReferenceSet(
        legacyClaim.evidenceIds,
        evidenceByLegacyId,
        `traces[${traceIndex}].claims[${claimIndex}].evidenceIds`,
      );
      const traceKey = `${trace.pageId}\u0000${legacyClaim.id}`;
      if (claimIdByLegacyTraceClaim[traceKey] !== undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Duplicate Wiki Claim Trace identity: ${trace.pageId}/${legacyClaim.id}`,
        );
      }
      const claimId = stableId(
        "wiki-claim",
        `${trace.pageId}:${legacyClaim.id}`,
      );
      if (claimIds.has(claimId)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Claim IDs collide after canonical adaptation: ${claimId}`,
        );
      }
      claimIds.add(claimId);
      claimIdByLegacyTraceClaim[traceKey] = claimId;

      const mappedEvidenceIds = legacyClaim.evidenceIds.map((legacyId) => {
        const mapped = stableId("wiki-evidence", legacyId);
        evidenceIdByLegacyId[legacyId] = mapped;
        const backlinks = claimIdsByEvidenceId.get(mapped) ?? new Set<string>();
        backlinks.add(claimId);
        claimIdsByEvidenceId.set(mapped, backlinks);
        return mapped;
      });
      const hasEvidence = mappedEvidenceIds.length > 0;
      claims.push(
        ClaimV1Schema.parse({
          id: claimId,
          taskId,
          kind: hasEvidence ? "conclusion" : "unknown",
          statement: sanitizeEvidenceExcerpt(legacyClaim.text),
          epistemicStatus: hasEvidence ? "inferred" : "unknown",
          lifecycleStatus: hasEvidence ? "supported" : "draft",
          freshness: "current",
          sourceSnapshotId,
          evidenceIds: mappedEvidenceIds,
          findingIds: [],
          verificationRecordIds: [],
          ...(hasEvidence
            ? {
                derivationPath: mappedEvidenceIds.map((evidenceId) => ({
                  kind: "evidence" as const,
                  evidenceId,
                  description: "Adapted from a Wiki V2 Claim Trace.",
                })),
              }
            : {
                boundaryReason:
                  "The Wiki V2 Claim Trace did not identify supporting Evidence.",
              }),
          createdAt,
          updatedAt: createdAt,
        }),
      );
    });
  });

  const evidence: EvidenceV1[] = wikiIndex.evidence.map((legacyEvidence) => {
    const filePath = RepositoryRelativePathSchema.parse(legacyEvidence.filePath);
    assertEvidenceSourcePathAllowed(filePath);
    const [start, end] = legacyEvidence.lineRange;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 1 ||
      end < start
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki Evidence has an invalid line range: ${legacyEvidence.id}`,
      );
    }
    const hasSourceContent =
      options.sourceContents !== undefined &&
      Object.prototype.hasOwnProperty.call(options.sourceContents, filePath);
    const content = hasSourceContent
      ? options.sourceContents?.[filePath]
      : undefined;
    const providedDigest = options.sourceContentDigests?.[filePath];
    if (content === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Verified source content bytes are required for Wiki Evidence ${legacyEvidence.id}; a digest alone cannot validate file and line anchors.`,
        { filePath },
      );
    }
    if (typeof content !== "string" && !(content instanceof Uint8Array)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki Evidence source content has an unsupported type: ${legacyEvidence.id}.`,
        { filePath },
      );
    }
    const sourceText = normalizeSourceNewlines(
      decodeEvidenceSourceContent(content, legacyEvidence.id),
    );
    const sourceLines = sourceText.split("\n");
    const totalLines = sourceLines.length;
    if (end > totalLines) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Wiki Evidence line range exceeds its source file: ${legacyEvidence.id}.`,
        { filePath, lineRange: legacyEvidence.lineRange, totalLines },
      );
    }
    if (legacyEvidence.excerpt !== undefined) {
      const rawExcerpt = normalizeSourceNewlines(legacyEvidence.excerpt);
      const sourceSlice = sourceLines.slice(start - 1, end).join("\n");
      if (!sourceSlice.includes(rawExcerpt)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Wiki Evidence excerpt does not occur within its source line range: ${legacyEvidence.id}.`,
          { filePath, lineRange: legacyEvidence.lineRange },
        );
      }
    }
    const contentHash = sha256Bytes(content);
    if (
      providedDigest !== undefined &&
      ContentDigestSchema.parse(providedDigest) !== contentHash
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `Provided source digest conflicts with source content for Wiki Evidence ${legacyEvidence.id}.`,
        { filePath },
      );
    }
    const id = stableId("wiki-evidence", legacyEvidence.id);
    evidenceIdByLegacyId[legacyEvidence.id] = id;
    return EvidenceV1Schema.parse({
      id,
      kind: mapEvidenceKind(legacyEvidence.evidenceType),
      epistemicStatus: "observed",
      freshness: "current",
      claimIds: [...(claimIdsByEvidenceId.get(id) ?? [])].sort(),
      nodeIds: [...new Set(legacyEvidence.nodeIds)],
      filePath,
      lineRange: [start, end],
      ...(legacyEvidence.excerpt === undefined
        ? {}
        : { excerpt: sanitizeEvidenceExcerpt(legacyEvidence.excerpt) }),
      contentHash,
      producedBy: options.producedBy,
      createdAt,
      observedAtSnapshotId: sourceSnapshotId,
    });
  });

  validateClaimEvidenceLinks(claims, evidence);
  return {
    claims,
    evidence,
    claimIdByLegacyTraceClaim,
    evidenceIdByLegacyId,
  };
}

export interface EvidenceInvalidationOptions {
  checkedAt: string;
  currentContentDigests: Readonly<
    Record<string, ContentDigest | null | undefined>
  >;
}

export function invalidateEvidenceForSourceChanges(
  evidence: readonly EvidenceV1[],
  options: EvidenceInvalidationOptions,
): EvidenceV1[] {
  const checkedAt = IsoTimestampSchema.parse(options.checkedAt);
  return evidence.map((item) => {
    if (
      !["source", "config", "test", "document"].includes(item.kind) ||
      !("filePath" in item) ||
      !Object.prototype.hasOwnProperty.call(
        options.currentContentDigests,
        item.filePath,
      )
    ) {
      return item;
    }
    const currentDigest = options.currentContentDigests[item.filePath];
    if (currentDigest === null || currentDigest === undefined) {
      return EvidenceV1Schema.parse({
        ...item,
        freshness: "invalid",
        freshnessReason: "The source file is no longer readable.",
        invalidatedAt: checkedAt,
        invalidationReason: "source_missing",
      });
    }
    const parsedDigest = ContentDigestSchema.parse(currentDigest);
    const {
      invalidatedAt: _invalidatedAt,
      invalidationReason: _invalidationReason,
      freshnessReason: _freshnessReason,
      ...withoutInvalidation
    } = item;
    if (parsedDigest === item.contentHash) {
      return EvidenceV1Schema.parse({
        ...withoutInvalidation,
        freshness: "current",
      });
    }
    return EvidenceV1Schema.parse({
      ...withoutInvalidation,
      freshness: "stale",
      freshnessReason: `Source content digest changed from ${item.contentHash} to ${parsedDigest}.`,
    });
  });
}

const FRESHNESS_RANK: Readonly<Record<EvidenceFreshnessV1, number>> = {
  current: 0,
  changed: 1,
  stale: 2,
  invalid: 3,
};

export function propagateEvidenceFreshnessToClaims(
  claims: readonly ClaimV1[],
  evidence: readonly EvidenceV1[],
  updatedAt: string,
): ClaimV1[] {
  const parsedUpdatedAt = IsoTimestampSchema.parse(updatedAt);
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  return claims.map((claim) => {
    const linked = claim.evidenceIds.map((id) => {
      const item = evidenceById.get(id);
      if (item === undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Claim ${claim.id} references missing Evidence ${id}.`,
        );
      }
      return item;
    });
    const worst = linked.reduce<EvidenceFreshnessV1>(
      (current, item) =>
        FRESHNESS_RANK[item.freshness] > FRESHNESS_RANK[current]
          ? item.freshness
          : current,
      claim.freshness,
    );
    if (worst === claim.freshness) return claim;
    return ClaimV1Schema.parse({
      ...claim,
      freshness: worst,
      lifecycleStatus:
        worst === "invalid" ? "invalidated" : claim.lifecycleStatus,
      updatedAt: parsedUpdatedAt,
    });
  });
}
