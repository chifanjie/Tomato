import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ArtifactStoreError } from "@understand-code/artifact-store";
import {
  CheckChangeInputV1Schema,
  RecordVerificationInputV1Schema,
  UpdateTaskInputV1Schema,
  classifyChangeCheckV1,
  type ChangeCheckV1,
  type ChangeCheckReadClassificationV1,
} from "@understand-code/contracts";
import {
  BuildTaskBriefInputV1Schema,
  BuildTaskBriefOutputV1Schema,
  CheckChangeOutputV1Schema,
  GetEvidenceInputV1Schema,
  GetEvidenceOutputV1Schema,
  GetRepoPulseInputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefInputV1Schema,
  GetTaskBriefOutputV1Schema,
  OpenWorkbenchInputV1Schema,
  OpenWorkbenchOutputV1Schema,
  RecordVerificationOutputV1Schema,
  SearchContextInputV1Schema,
  SearchContextOutputV1Schema,
  TraceImpactInputV1Schema,
  TraceImpactOutputV1Schema,
  UpdateTaskOutputV1Schema,
  type McpToolErrorResultV1,
} from "@understand-code/contracts/mcp";
import {
  isSensitiveRepositoryPath,
  projectRepoPulseSurface,
  readStableRepositoryFile,
} from "@understand-code/repository-state";
import {
  RepositoryTaskContextProviderError,
  TaskEngineError,
} from "@understand-code/task-engine";
import { validateGraph } from "@understand-code/core";
import {
  parseWikiIndexV2,
  parseWikiSearchIndexV2,
} from "@understand-code/core/knowledge-base";
import {
  openWorkbenchSessionV1,
  type WorkbenchDashboardBundleV1,
  type WorkbenchDashboardReadRequestV1,
  type WorkbenchDashboardReadResultV1,
  type WorkbenchDashboardReaderV1,
  type WorkbenchContextReaderV1,
  type WorkbenchContextRequestV1,
  type WorkbenchContextResultV1,
  type WorkbenchContextUnavailableReasonV1,
  type WorkbenchEvidenceReaderV1,
  type WorkbenchEvidenceRequestV1,
  type WorkbenchEvidenceResultV1,
  type WorkbenchTraceReaderV1,
} from "@understand-code/workbench-runtime";
import {
  INSTALLATION_WORKBENCH_UI,
  managedLegacyWorkbenchUiAllowedV1,
} from "@understand-code/installation-lifecycle";

import { PRODUCT_VERSION } from "../constants.js";
import {
  failStrongStoreUnavailableV1,
  refreshIndex,
} from "./refresh-index.js";
import {
  ToolFailure,
  artifactUnavailableFailure,
  idempotencyConflictFailure,
  internalErrorFailure,
  invalidArgumentFailure,
  invalidArgumentsFailure,
  repositoryNotReadyFailure,
  resourceNotFoundFailure,
  sourceAccessDeniedFailure,
  taskGateFailure,
} from "../errors/tool-errors.js";
import {
  openRuntime,
  readPublishedPulse,
  readPublishedSnapshot,
} from "../runtime/context.js";

export const IMPLEMENTED_TOOL_NAMES = Object.freeze([
  "get_repo_pulse",
  "build_task_brief",
  "get_task_brief",
  "update_task",
  "check_change",
  "record_verification",
  "open_workbench",
  "get_evidence",
  "search_context",
  "trace_impact",
  "refresh_index",
] as const);

export type ImplementedToolName = (typeof IMPLEMENTED_TOOL_NAMES)[number];

function elapsed(startedAt: number): number {
  return Math.max(0, performance.now() - startedAt);
}

type PageCursorIdentity = Readonly<{
  kind: string;
  taskId: string;
  revision: number;
  requestDigest: string;
}>;

function encodePageCursor(identity: PageCursorIdentity, offset: number): string {
  return Buffer.from(
    JSON.stringify({ version: 1, ...identity, offset }),
    "utf8",
  ).toString("base64url");
}

function decodePageCursor(
  cursor: string | undefined,
  identity: PageCursorIdentity,
): number {
  if (cursor === undefined) return 0;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      (parsed as { version?: unknown }).version !== 1 ||
      (parsed as { kind?: unknown }).kind !== identity.kind ||
      (parsed as { taskId?: unknown }).taskId !== identity.taskId ||
      (parsed as { revision?: unknown }).revision !== identity.revision ||
      (parsed as { requestDigest?: unknown }).requestDigest !==
        identity.requestDigest ||
      !Number.isSafeInteger((parsed as { offset?: unknown }).offset) ||
      ((parsed as { offset: number }).offset) < 0
    ) {
      throw new Error("cursor identity mismatch");
    }
    return (parsed as { offset: number }).offset;
  } catch {
    throw new ToolFailure(invalidArgumentFailure(["cursor"], "invalid_cursor"));
  }
}

async function readTaskScopedContext(
  runtime: Awaited<ReturnType<typeof openRuntime>>,
  taskId: string,
) {
  const manifest = await runtime.store.readManifest({ verifyArtifacts: false });
  const taskDescriptor = manifest.artifacts.find(
    (descriptor) =>
      descriptor.taskId === taskId && descriptor.artifactType === "task_manifest",
  );
  if (taskDescriptor === undefined) {
    throw new ToolFailure(resourceNotFoundFailure("task", taskId));
  }
  const read = await runtime.store.readTaskBundle(taskId);
  if (
    read.bundle.manifest.taskId !== taskId ||
    read.bundle.manifest.repositoryId !== runtime.store.repositoryId ||
    read.bundle.manifest.worktreeId !== runtime.store.worktreeId ||
    taskDescriptor.sourceSnapshotId !== read.bundle.manifest.latestSnapshotId
  ) {
    throw new ToolFailure(artifactUnavailableFailure("corrupt", "task_context"));
  }
  const publishedSnapshot = await readPublishedSnapshot(
    runtime.store,
    read.bundle.manifest.latestSnapshotId,
  );
  const publishedPulse = await readPublishedPulse(runtime.store);
  const freshness =
    publishedPulse.pulse.evaluatedSnapshotId ===
    read.bundle.manifest.latestSnapshotId
      ? publishedPulse.pulse.status
      : "stale";
  return { read, publishedSnapshot, freshness };
}

async function getEvidence(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = GetEvidenceInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  failStrongStoreUnavailableV1();
  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  const context = await readTaskScopedContext(runtime, parsed.data.taskId);
  const bundle = context.read.bundle;
  if (!("evidence" in bundle)) {
    throw new ToolFailure(artifactUnavailableFailure("missing", "evidence_ledger"));
  }
  const evidence = bundle.evidence;
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const requestDigest = createRequestDigest({
    taskId: parsed.data.taskId,
    evidenceIds: parsed.data.evidenceIds,
    maxExcerptChars: parsed.data.maxExcerptChars ?? null,
  });
  const identity: PageCursorIdentity = {
    kind: "get_evidence",
    taskId: parsed.data.taskId,
    revision: bundle.manifest.revision,
    requestDigest,
  };
  const entries = parsed.data.evidenceIds.map((id) => ({
    id,
    evidence: evidenceById.get(id),
  }));
  const offset = decodePageCursor(parsed.data.cursor, identity);
  if (offset > entries.length) {
    throw new ToolFailure(invalidArgumentFailure(["cursor"], "invalid_cursor"));
  }
  const pageSize = parsed.data.pageSize ?? 50;
  const pageEntries = entries.slice(offset, offset + pageSize);
  const maxExcerptChars = parsed.data.maxExcerptChars;
  const pageEvidence = pageEntries
    .filter((entry): entry is { id: string; evidence: (typeof evidence)[number] } =>
      entry.evidence !== undefined,
    )
    .map(({ evidence: item }) => {
      if (maxExcerptChars === undefined || !("excerpt" in item) || item.excerpt === undefined) {
        return item;
      }
      return { ...item, excerpt: item.excerpt.slice(0, maxExcerptChars) };
    });
  const missingEvidenceIds = pageEntries
    .filter((entry) => entry.evidence === undefined)
    .map((entry) => entry.id);
  const nextOffset = offset + pageEntries.length;
  const hasMore = nextOffset < entries.length;
  return GetEvidenceOutputV1Schema.parse({
    isError: false,
    content: [{ type: "text", text: "Task evidence loaded." }],
    structuredContent: {
      schemaVersion: 1,
      meta: successMeta(
        context.publishedSnapshot,
        context.freshness,
        elapsed(startedAt),
        {
          cacheHit: true,
          truncatedCategories: hasMore ? ["evidence"] : [],
        },
      ),
      page: {
        pageSize,
        returned: pageEntries.length,
        total: entries.length,
        ...(hasMore ? { nextCursor: encodePageCursor(identity, nextOffset) } : {}),
        hasMore,
      },
      result: { evidence: pageEvidence, missingEvidenceIds },
    },
  });
}

function createRequestDigest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")}`;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function searchTokens(value: string): readonly string[] {
  const normalized = normalizeSearchText(value);
  return normalized.length === 0 ? [] : [...new Set(normalized.split(" "))];
}

function scoreSearchCandidate(
  query: string,
  fields: readonly string[],
): { readonly score: number; readonly reasons: readonly string[] } | undefined {
  const queryPhrase = normalizeSearchText(query);
  const tokens = searchTokens(query);
  const haystack = normalizeSearchText(fields.join(" "));
  if (queryPhrase.length === 0 || haystack.length === 0) return undefined;
  const matched = tokens.filter((token) => haystack.includes(token));
  if (matched.length === 0 && !haystack.includes(queryPhrase)) return undefined;
  const exact = haystack.includes(queryPhrase) ? 1 : 0;
  const lexical = tokens.length === 0 ? 0 : matched.length / tokens.length;
  const reasons = [
    ...(exact > 0 ? ["exact query phrase match"] : []),
    ...(matched.length > 0 ? [`matched ${matched.length} query token${matched.length === 1 ? "" : "s"}`] : []),
  ];
  return {
    score: Math.round((exact * 0.6 + lexical * 0.4) * 1_000) / 1_000,
    reasons: reasons.length > 0 ? reasons : ["query match"],
  };
}

function pathMatchesPrefix(filePath: string, prefix: string): boolean {
  const pathValue = filePath.replaceAll("\\", "/").replace(/^\.\//u, "");
  const prefixValue = prefix.replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/$/u, "");
  return pathValue === prefixValue || pathValue.startsWith(`${prefixValue}/`);
}

type SearchCandidate = {
  readonly kind: "file" | "symbol" | "wiki" | "graph";
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly filePath?: string;
  readonly symbolId?: string;
  readonly documentId?: string;
  readonly nodeId?: string;
};

async function searchContext(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = SearchContextInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  failStrongStoreUnavailableV1();
  if (parsed.data.taskId === undefined) {
    throw new ToolFailure(artifactUnavailableFailure("missing", "task_context"));
  }
  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  const context = await readTaskScopedContext(runtime, parsed.data.taskId);
  const bundle = context.read.bundle;
  if (!("brief" in bundle) || !("claims" in bundle) || !("evidence" in bundle) || !("impactPaths" in bundle)) {
    throw new ToolFailure(artifactUnavailableFailure("missing", "task_context"));
  }
  const scopes = new Set(parsed.data.scopes ?? ["file", "symbol", "wiki", "graph"]);
  const pathPrefixes = parsed.data.pathPrefixes ?? [];
  const candidates: SearchCandidate[] = [];
  const addCandidate = (
    candidate: SearchCandidate,
    fields: readonly string[],
  ): void => {
    if (!scopes.has(candidate.kind)) return;
    if (
      pathPrefixes.length > 0 &&
      (candidate.filePath === undefined ||
        !pathPrefixes.some((prefix) => pathMatchesPrefix(candidate.filePath!, prefix)))
    ) {
      return;
    }
    const match = scoreSearchCandidate(parsed.data.query, fields);
    if (match === undefined) return;
    candidates.push({ ...candidate, score: match.score, reasons: match.reasons });
  };

  for (const claim of bundle.claims) {
    addCandidate(
      {
        kind: "wiki",
        id: claim.id,
        documentId: claim.id,
        title: `${claim.kind} claim`,
        summary: claim.statement.slice(0, 8_192),
        score: 0,
        reasons: [],
        evidenceIds: claim.evidenceIds,
      },
      [claim.statement, claim.kind, claim.lifecycleStatus],
    );
  }
  for (const item of bundle.evidence) {
    const summary =
      ("excerpt" in item && item.excerpt !== undefined
        ? item.excerpt
        : `${item.kind} evidence produced by ${item.producedBy}`
      ).slice(0, 8_192);
    if ("filePath" in item) {
      addCandidate(
        {
          kind: "file",
          id: item.id,
          title: item.filePath,
          filePath: item.filePath,
          summary,
          score: 0,
          reasons: [],
          evidenceIds: [item.id],
        },
        [item.filePath, summary, item.producedBy],
      );
    } else {
      addCandidate(
        {
          kind: item.kind === "graph_path" ? "graph" : "wiki",
          id: item.id,
          ...(item.kind === "graph_path"
            ? { nodeId: item.nodeIds[0] ?? item.id }
            : { documentId: item.id }),
          title: `${item.kind} evidence`,
          summary,
          score: 0,
          reasons: [],
          evidenceIds: [item.id],
        },
        [item.kind, summary, item.producedBy, ...item.nodeIds],
      );
    }
  }
  for (const impactPath of bundle.impactPaths) {
    const evidenceIds = impactPath.steps.flatMap((step) =>
      step.evidenceId === undefined ? [] : [step.evidenceId],
    );
    addCandidate(
      {
        kind: "graph",
        id: impactPath.id,
        nodeId: impactPath.targetNodeId,
        title: `${impactPath.sourceNodeId} to ${impactPath.targetNodeId}`,
        summary: `${impactPath.classification} impact path${impactPath.boundaryReason === undefined ? "" : `: ${impactPath.boundaryReason}`}`.slice(0, 8_192),
        score: 0,
        reasons: [],
        evidenceIds,
      },
      [
        impactPath.sourceNodeId,
        impactPath.targetNodeId,
        impactPath.classification,
        ...impactPath.steps.flatMap((step) => [step.source, step.target, step.edgeType]),
      ],
    );
  }

  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.kind.localeCompare(right.kind) ||
      left.id.localeCompare(right.id),
  );
  const requestDigest = createRequestDigest({
    taskId: parsed.data.taskId,
    query: parsed.data.query,
    scopes: parsed.data.scopes ?? null,
    pathPrefixes: parsed.data.pathPrefixes ?? null,
    tokenBudget: parsed.data.tokenBudget ?? null,
  });
  const identity: PageCursorIdentity = {
    kind: "search_context",
    taskId: parsed.data.taskId,
    revision: bundle.manifest.revision,
    requestDigest,
  };
  const offset = decodePageCursor(parsed.data.cursor, identity);
  if (offset > candidates.length) {
    throw new ToolFailure(invalidArgumentFailure(["cursor"], "invalid_cursor"));
  }
  const pageSize = parsed.data.pageSize ?? 50;
  const tokenBudget = parsed.data.tokenBudget ?? 8_000;
  const pageResults: SearchCandidate[] = [];
  let consumedTokens = 0;
  for (let index = offset; index < candidates.length && pageResults.length < pageSize; index += 1) {
    const candidate = candidates[index]!;
    const estimatedTokens = Math.max(1, Math.ceil(candidate.summary.length / 4));
    if (pageResults.length > 0 && consumedTokens + estimatedTokens > tokenBudget) break;
    pageResults.push(candidate);
    consumedTokens += estimatedTokens;
  }
  const nextOffset = offset + pageResults.length;
  const hasMore = nextOffset < candidates.length;
  const truncatedCategories = hasMore ? ["search_results"] : [];
  return SearchContextOutputV1Schema.parse({
    isError: false,
    content: [{ type: "text", text: "Task context search completed." }],
    structuredContent: {
      schemaVersion: 1,
      meta: successMeta(
        context.publishedSnapshot,
        context.freshness,
        elapsed(startedAt),
        { cacheHit: true, truncatedCategories },
      ),
      page: {
        pageSize,
        returned: pageResults.length,
        total: candidates.length,
        ...(hasMore ? { nextCursor: encodePageCursor(identity, nextOffset) } : {}),
        hasMore,
      },
      result: {
        results: pageResults.map(({ filePath, symbolId, documentId, nodeId, ...base }) => ({
          ...base,
          ...(filePath === undefined ? {} : { filePath }),
          ...(symbolId === undefined ? {} : { symbolId, filePath: filePath! }),
          ...(documentId === undefined ? {} : { documentId }),
          ...(nodeId === undefined ? {} : { nodeId }),
        })),
      },
    },
  });
}

async function traceImpact(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = TraceImpactInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  failStrongStoreUnavailableV1();
  if (parsed.data.taskId === undefined) {
    throw new ToolFailure(artifactUnavailableFailure("missing", "task_context"));
  }
  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  const context = await readTaskScopedContext(runtime, parsed.data.taskId);
  const bundle = context.read.bundle;
  if (!("impactPaths" in bundle)) {
    throw new ToolFailure(artifactUnavailableFailure("missing", "impact"));
  }
  const sourceIds = new Set(parsed.data.sourceNodeIds);
  const targetIds = parsed.data.targetNodeIds === undefined ? undefined : new Set(parsed.data.targetNodeIds);
  const direction = parsed.data.direction;
  const maxDepth = parsed.data.maxDepth ?? 20;
  const matchesEndpoint = (pathValue: (typeof bundle.impactPaths)[number]): boolean => {
    const sourceMatch =
      direction === "downstream"
        ? sourceIds.has(pathValue.sourceNodeId)
        : direction === "upstream"
          ? sourceIds.has(pathValue.targetNodeId)
          : sourceIds.has(pathValue.sourceNodeId) || sourceIds.has(pathValue.targetNodeId);
    if (!sourceMatch) return false;
    if (targetIds === undefined) return true;
    return direction === "downstream"
      ? targetIds.has(pathValue.targetNodeId)
      : direction === "upstream"
        ? targetIds.has(pathValue.sourceNodeId)
        : targetIds.has(pathValue.sourceNodeId) || targetIds.has(pathValue.targetNodeId);
  };
  const filtered = bundle.impactPaths.filter(
    (pathValue) => pathValue.steps.length <= maxDepth && matchesEndpoint(pathValue),
  );
  const maxPaths = parsed.data.maxPaths ?? filtered.length;
  const capped = filtered.slice(0, maxPaths);
  const knownNodeIds = new Set<string>();
  for (const pathValue of bundle.impactPaths) {
    knownNodeIds.add(pathValue.sourceNodeId);
    knownNodeIds.add(pathValue.targetNodeId);
    for (const step of pathValue.steps) {
      knownNodeIds.add(step.source);
      knownNodeIds.add(step.target);
    }
  }
  const unresolvedNodeIds = [
    ...new Set([
      ...parsed.data.sourceNodeIds,
      ...(parsed.data.targetNodeIds ?? []),
    ]),
  ].filter((nodeId) => !knownNodeIds.has(nodeId));
  const requestDigest = createRequestDigest({
    taskId: parsed.data.taskId,
    sourceNodeIds: parsed.data.sourceNodeIds,
    targetNodeIds: parsed.data.targetNodeIds ?? null,
    direction,
    maxDepth,
    maxPaths,
  });
  const identity: PageCursorIdentity = {
    kind: "trace_impact",
    taskId: parsed.data.taskId,
    revision: bundle.manifest.revision,
    requestDigest,
  };
  const entries = [
    ...capped.map((pathValue) => ({ kind: "path" as const, value: pathValue })),
    ...unresolvedNodeIds.map((nodeId) => ({ kind: "unresolved" as const, value: nodeId })),
  ];
  const offset = decodePageCursor(parsed.data.cursor, identity);
  if (offset > entries.length) {
    throw new ToolFailure(invalidArgumentFailure(["cursor"], "invalid_cursor"));
  }
  const pageSize = parsed.data.pageSize ?? 50;
  const pageEntries = entries.slice(offset, offset + pageSize);
  const paths = pageEntries
    .filter((entry): entry is { kind: "path"; value: (typeof capped)[number] } => entry.kind === "path")
    .map((entry) => entry.value);
  const unresolved = pageEntries
    .filter((entry): entry is { kind: "unresolved"; value: string } => entry.kind === "unresolved")
    .map((entry) => entry.value);
  const nextOffset = offset + pageEntries.length;
  const hasMore = nextOffset < entries.length;
  const truncatedCategories = [
    ...(filtered.length > capped.length ? ["impact_paths"] : []),
    ...(hasMore ? ["impact_page"] : []),
  ];
  return TraceImpactOutputV1Schema.parse({
    isError: false,
    content: [{ type: "text", text: "Task impact paths loaded." }],
    structuredContent: {
      schemaVersion: 1,
      meta: successMeta(
        context.publishedSnapshot,
        context.freshness,
        elapsed(startedAt),
        { cacheHit: true, truncatedCategories },
      ),
      page: {
        pageSize,
        returned: pageEntries.length,
        total: entries.length,
        ...(hasMore ? { nextCursor: encodePageCursor(identity, nextOffset) } : {}),
        hasMore,
      },
      result: { paths, unresolvedNodeIds: unresolved },
    },
  });
}

function successMeta(
  snapshot: Awaited<ReturnType<typeof readPublishedSnapshot>>,
  freshness: "not_ready" | "fresh" | "partial" | "stale" | "unknown" | "rebuilding" | "error",
  durationMs: number,
  options: {
    readonly cacheHit: boolean;
    readonly truncated?: boolean;
    readonly truncatedCategories?: readonly string[];
  },
) {
  const truncatedCategories = [...(options.truncatedCategories ?? [])];
  return {
    repositoryId: snapshot.snapshot.repositoryId,
    worktreeId: snapshot.snapshot.worktreeId,
    sourceSnapshotId: snapshot.snapshot.snapshotId,
    headCommit: snapshot.snapshot.headCommit ?? null,
    worktreeFingerprint: snapshot.worktreeFingerprint,
    freshness,
    durationMs,
    cacheHit: options.cacheHit,
    truncated: options.truncated ?? truncatedCategories.length > 0,
    truncatedCategories,
  };
}

async function getRepoPulse(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = GetRepoPulseInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  const published = await readPublishedPulse(runtime.store);
  const pulse = projectRepoPulseSurface(published.pulse);
  return GetRepoPulseOutputV1Schema.parse({
    isError: false,
    content: [{ type: "text", text: "Repository pulse loaded." }],
    structuredContent: {
      schemaVersion: 1,
      meta: {
        durationMs: elapsed(startedAt),
        cacheHit: true,
      },
      result: { pulse },
    },
  });
}

async function buildTaskBrief(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = BuildTaskBriefInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  failStrongStoreUnavailableV1();
  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  const result = await runtime.taskEngine.buildTaskBrief(parsed.data, {
    actor: parsed.data.actor,
    repositoryId: runtime.store.repositoryId,
    worktreeId: runtime.store.worktreeId,
    capabilities: ["task:create"],
  });
  const [snapshot, publishedPulse] = await Promise.all([
    readPublishedSnapshot(runtime.store, result.task.latestSnapshotId),
    readPublishedPulse(runtime.store),
  ]);
  const freshness =
    publishedPulse.pulse.evaluatedSnapshotId === result.task.latestSnapshotId
      ? publishedPulse.pulse.status
      : "stale";
  return BuildTaskBriefOutputV1Schema.parse({
    isError: false,
    content: [{ type: "text", text: "Task Brief is ready." }],
    structuredContent: {
      schemaVersion: 1,
      meta: successMeta(snapshot, freshness, elapsed(startedAt), {
        cacheHit: result.mutation.idempotentReplay,
      }),
      result,
    },
  });
}

async function getTaskBrief(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = GetTaskBriefInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  failStrongStoreUnavailableV1();
  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  const manifest = await runtime.store.readManifest({ verifyArtifacts: false });
  if (
    !manifest.artifacts.some(
      (descriptor) =>
        descriptor.taskId === parsed.data.taskId &&
        descriptor.artifactType === "task_manifest",
    )
  ) {
    throw new ToolFailure(resourceNotFoundFailure("task", parsed.data.taskId));
  }
  const page = await runtime.taskEngine.getTaskBrief(parsed.data);
  const [snapshot, publishedPulse] = await Promise.all([
    readPublishedSnapshot(runtime.store, page.result.task.latestSnapshotId),
    readPublishedPulse(runtime.store),
  ]);
  const freshness =
    publishedPulse.pulse.evaluatedSnapshotId === page.result.task.latestSnapshotId
      ? publishedPulse.pulse.status
      : "stale";
  const pageSize = parsed.data.pageSize ?? 50;
  const hasMore = page.nextCursor !== undefined;
  return GetTaskBriefOutputV1Schema.parse({
    isError: false,
    content: [{ type: "text", text: "Task Brief section loaded." }],
    structuredContent: {
      schemaVersion: 1,
      meta: successMeta(snapshot, freshness, elapsed(startedAt), {
        cacheHit: true,
        truncatedCategories: hasMore ? ["task_brief_items"] : [],
      }),
      page: {
        pageSize,
        returned: page.result.items.length,
        total: page.total,
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
        hasMore,
      },
      result: page.result,
    },
  });
}

async function updateTask(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = UpdateTaskInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  failStrongStoreUnavailableV1();
  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  const result = await runtime.taskEngine.updateTask(parsed.data, {
    actor: parsed.data.actor,
    repositoryId: runtime.store.repositoryId,
    worktreeId: runtime.store.worktreeId,
    capabilities: [
      "task:update",
      "task:confirm",
      "task:accept",
      "task:supersede",
    ],
  });
  const [snapshot, publishedPulse] = await Promise.all([
    readPublishedSnapshot(runtime.store, result.task.latestSnapshotId),
    readPublishedPulse(runtime.store),
  ]);
  const freshness =
    publishedPulse.pulse.evaluatedSnapshotId === result.task.latestSnapshotId
      ? publishedPulse.pulse.status
      : "stale";
  return UpdateTaskOutputV1Schema.parse({
    isError: false,
    content: [{ type: "text", text: "Task updated." }],
    structuredContent: {
      schemaVersion: 1,
      meta: successMeta(snapshot, freshness, elapsed(startedAt), {
        cacheHit: result.mutation.idempotentReplay,
      }),
      result,
    },
  });
}

async function checkChange(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = CheckChangeInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  failStrongStoreUnavailableV1();
  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  const result = await runtime.taskEngine.checkChange(
    parsed.data,
    {
      actor: parsed.data.actor,
      repositoryId: runtime.store.repositoryId,
      worktreeId: runtime.store.worktreeId,
      capabilities: ["task:update"],
    },
  );
  const [snapshot, publishedPulse] = await Promise.all([
    readPublishedSnapshot(runtime.store, result.changeCheck.actualSnapshotId),
    readPublishedPulse(runtime.store),
  ]);
  const freshness =
    publishedPulse.pulse.evaluatedSnapshotId === result.changeCheck.actualSnapshotId
      ? publishedPulse.pulse.status
      : "stale";
  return CheckChangeOutputV1Schema.parse({
    isError: false,
    content: [{
      type: "text",
      text:
        "Change Check recorded as a legacy summary; empty findings are not clean evidence.",
    }],
    structuredContent: {
      schemaVersion: 1,
      meta: successMeta(snapshot, freshness, elapsed(startedAt), {
        cacheHit: result.mutation.idempotentReplay,
      }),
      result,
    },
  });
}

async function recordVerification(
  argumentsValue: unknown,
  canonicalRoot: string,
) {
  const parsed = RecordVerificationInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  failStrongStoreUnavailableV1();
  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  const manifest = await runtime.store.readManifest({ verifyArtifacts: false });
  const latestSnapshotId = manifest.artifacts
    .filter((descriptor) => descriptor.artifactType === "task_manifest")
    .find((descriptor) => descriptor.taskId === parsed.data.taskId)
    ?.sourceSnapshotId;
  if (latestSnapshotId === undefined) {
    throw new ToolFailure(resourceNotFoundFailure("task", parsed.data.taskId));
  }
  const result = await runtime.taskEngine.recordVerification(parsed.data, {
    actor: parsed.data.actor,
    repositoryId: runtime.store.repositoryId,
    worktreeId: runtime.store.worktreeId,
    capabilities: ["task:update"],
  });
  const [snapshot, publishedPulse] = await Promise.all([
    readPublishedSnapshot(runtime.store, result.verification.snapshotId),
    readPublishedPulse(runtime.store),
  ]);
  const freshness =
    publishedPulse.pulse.evaluatedSnapshotId === result.verification.snapshotId
      ? publishedPulse.pulse.status
      : "stale";
  return RecordVerificationOutputV1Schema.parse({
    isError: false,
    content: [{ type: "text", text: "Verification record appended." }],
    structuredContent: {
      schemaVersion: 1,
      meta: successMeta(snapshot, freshness, elapsed(startedAt), {
        cacheHit: result.mutation.idempotentReplay,
      }),
      result,
    },
  });
}

type PublishedJsonReadV1 =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly reason: "not_published" | "invalid_artifact" | "read_failed" };

const DASHBOARD_BUNDLE_SCHEMA_VERSION = "understand-code-dashboard-bundle-v1";
const DASHBOARD_MAX_FILES = 4_096;
const DASHBOARD_MAX_FILE_BYTES = 32 * 1024 * 1024;
const DASHBOARD_MAX_TOTAL_BYTES = 96 * 1024 * 1024;

function recordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function dashboardInventoryDescriptor(
  root: string,
): Promise<Pick<WorkbenchDashboardBundleV1, "fileCount" | "inventorySha256">> {
  const entries: Array<{ path: string; sha256: `sha256:${string}`; bytes: number }> = [];
  let totalBytes = 0;
  const walk = async (directory: string, relativeDirectory: string): Promise<void> => {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const child of children) {
      if (
        child.name === "" || child.name === "." || child.name === ".." ||
        child.name.includes("/") || child.name.includes("\\") || child.name.includes("\u0000")
      ) throw new Error("dashboard_path_invalid");
      const relativePath = relativeDirectory === ""
        ? child.name
        : `${relativeDirectory}/${child.name}`;
      const absolutePath = path.join(directory, child.name);
      const metadata = await lstat(absolutePath);
      if (metadata.isSymbolicLink()) throw new Error("dashboard_symlink");
      if (metadata.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!metadata.isFile() || metadata.size > DASHBOARD_MAX_FILE_BYTES || entries.length >= DASHBOARD_MAX_FILES) {
        throw new Error("dashboard_file_invalid");
      }
      const bytes = await readFile(absolutePath);
      totalBytes += bytes.byteLength;
      if (totalBytes > DASHBOARD_MAX_TOTAL_BYTES) throw new Error("dashboard_too_large");
      entries.push({
        path: relativePath,
        sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
        bytes: bytes.byteLength,
      });
    }
  };
  await walk(root, "");
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return {
    fileCount: entries.length,
    inventorySha256: `sha256:${createHash("sha256")
      .update(Buffer.from(JSON.stringify(entries), "utf8"))
      .digest("hex")}`,
  };
}

let dashboardBundlePromise: Promise<WorkbenchDashboardBundleV1> | undefined;

function resolveWorkbenchDashboardBundle(): Promise<WorkbenchDashboardBundleV1> {
  dashboardBundlePromise ??= (async () => {
    const modulePath = fileURLToPath(import.meta.url);
    const bundled = path.extname(modulePath) === ".mjs";
    const packageDirectory = path.dirname(modulePath);
    const root = await realpath(
      bundled
        ? path.join(packageDirectory, "dashboard")
        : path.resolve(packageDirectory, "../../../dashboard/dist"),
    );
    if (!bundled) {
      return Object.freeze({ root, productVersion: PRODUCT_VERSION, ...await dashboardInventoryDescriptor(root) });
    }
    const manifestValue: unknown = JSON.parse(
      await readFile(path.join(packageDirectory, "dashboard-manifest.json"), "utf8"),
    );
    if (
      !recordValue(manifestValue) ||
      Object.keys(manifestValue).sort().join(",") !==
        "fileCount,inventorySha256,productVersion,root,schemaVersion" ||
      manifestValue.schemaVersion !== DASHBOARD_BUNDLE_SCHEMA_VERSION ||
      manifestValue.productVersion !== PRODUCT_VERSION ||
      manifestValue.root !== "dashboard" ||
      !Number.isSafeInteger(manifestValue.fileCount) ||
      typeof manifestValue.fileCount !== "number" ||
      manifestValue.fileCount < 1 ||
      manifestValue.fileCount > DASHBOARD_MAX_FILES ||
      typeof manifestValue.inventorySha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(manifestValue.inventorySha256)
    ) throw new Error("dashboard_manifest_invalid");
    return Object.freeze({
      root,
      productVersion: PRODUCT_VERSION,
      fileCount: manifestValue.fileCount,
      inventorySha256: manifestValue.inventorySha256 as `sha256:${string}`,
    });
  })();
  return dashboardBundlePromise;
}

type ResolvedWorkbenchUiV1 =
  | Readonly<{ dashboardBundle: WorkbenchDashboardBundleV1 }>
  | Readonly<{ workbenchUi: typeof INSTALLATION_WORKBENCH_UI }>;

async function pathIsAbsent(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }
}

async function resolveWorkbenchUi(): Promise<ResolvedWorkbenchUiV1> {
  try {
    return { dashboardBundle: await resolveWorkbenchDashboardBundle() };
  } catch (error) {
    const modulePath = fileURLToPath(import.meta.url);
    const packageDirectory = path.dirname(modulePath);
    const bundledDashboardIsAbsent =
      path.extname(modulePath) === ".mjs" &&
      await pathIsAbsent(path.join(packageDirectory, "dashboard")) &&
      await pathIsAbsent(path.join(packageDirectory, "dashboard-manifest.json"));
    if (
      !bundledDashboardIsAbsent ||
      !(await managedLegacyWorkbenchUiAllowedV1(modulePath))
    ) {
      throw error;
    }
    return { workbenchUi: INSTALLATION_WORKBENCH_UI };
  }
}

/**
 * Read a fixed ArtifactStore layout path without accepting a browser- or
 * caller-provided path.  A realpath check also keeps a malicious symlink in
 * the managed directory from turning the Workbench into a file oracle.
 */
async function readFixedPublishedJson(
  filePath: string,
  managedRoot: string,
): Promise<PublishedJsonReadV1> {
  try {
    const canonicalRoot = await realpath(managedRoot);
    const canonicalPath = await realpath(filePath);
    const relative = path.relative(canonicalRoot, canonicalPath);
    if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      return { ok: false, reason: "read_failed" };
    }
    const text = await readFile(canonicalPath, "utf8");
    try {
      return { ok: true, value: JSON.parse(text) as unknown };
    } catch {
      return { ok: false, reason: "invalid_artifact" };
    }
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { ok: false, reason: "not_published" };
    }
    return { ok: false, reason: "read_failed" };
  }
}

function unavailableContext(
  input: WorkbenchContextRequestV1,
  reason: WorkbenchContextUnavailableReasonV1,
): WorkbenchContextResultV1 {
  return {
    schemaVersion: 1,
    surface: input.surface,
    taskId: input.taskId,
    repositoryId: input.repositoryId,
    worktreeId: input.worktreeId,
    status: "unavailable",
    reason,
  };
}

const graphContextReader = (
  runtime: Awaited<ReturnType<typeof openRuntime>>,
): WorkbenchContextReaderV1 => async (input) => {
  if (input.surface !== "graph") {
    return unavailableContext(input, "read_failed");
  }
  const read = await readFixedPublishedJson(
    runtime.store.layout.knowledgeGraph,
    runtime.store.layout.storeRoot,
  );
  if (!read.ok) return unavailableContext(input, read.reason);
  const parsed = validateGraph(read.value);
  if (!parsed.success || parsed.data === undefined) {
    return unavailableContext(input, "invalid_artifact");
  }
  const graph = parsed.data;
  return {
    schemaVersion: 1,
    surface: "graph",
    taskId: input.taskId,
    repositoryId: input.repositoryId,
    worktreeId: input.worktreeId,
    status: "ready",
    artifact: {
      artifactPath: ".understand-code/knowledge-graph.json",
      metadata: {
        version: graph.version,
        projectName: graph.project.name,
        analyzedAt: graph.project.analyzedAt,
        gitCommitHash: graph.project.gitCommitHash,
      },
      counts: {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        layers: graph.layers.length,
        tour: graph.tour.length,
      },
    },
  };
};

const knowledgeContextReader = (
  runtime: Awaited<ReturnType<typeof openRuntime>>,
): WorkbenchContextReaderV1 => async (input) => {
  if (input.surface !== "knowledge") {
    return unavailableContext(input, "read_failed");
  }
  const read = await readFixedPublishedJson(
    path.join(runtime.store.layout.knowledgeBase, "wiki-index.json"),
    runtime.store.layout.storeRoot,
  );
  if (!read.ok) return unavailableContext(input, read.reason);
  const parsed = parseWikiIndexV2(read.value);
  if (!parsed.ok) return unavailableContext(input, "invalid_artifact");
  const wiki = parsed.value;
  return {
    schemaVersion: 1,
    surface: "knowledge",
    taskId: input.taskId,
    repositoryId: input.repositoryId,
    worktreeId: input.worktreeId,
    status: "ready",
    artifact: {
      artifactPath: ".understand-code/knowledge-base/wiki-index.json",
      metadata: {
        version: wiki.version,
        projectName: wiki.projectName,
        generatedAt: wiki.generatedAt,
        readiness: wiki.mainReadiness.status,
      },
      counts: {
        pages: wiki.pages.length,
        nodeDocumentation: wiki.nodeDocumentation.length,
        evidence: wiki.evidence.length,
      },
    },
  };
};

const DASHBOARD_ARTIFACT_MAX_BYTES = 64 * 1024 * 1024;

async function readFixedPublishedText(
  filePath: string,
  managedRoot: string,
  maxBytes = DASHBOARD_ARTIFACT_MAX_BYTES,
): Promise<{ readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: "missing" | "invalid" | "unavailable" }> {
  try {
    const canonicalRoot = await realpath(managedRoot);
    const canonicalPath = await realpath(filePath);
    const relative = path.relative(canonicalRoot, canonicalPath);
    if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      return { ok: false, reason: "invalid" };
    }
    const metadata = await lstat(canonicalPath);
    if (!metadata.isFile() || metadata.size > maxBytes) return { ok: false, reason: "invalid" };
    const bytes = await readFile(canonicalPath);
    if (bytes.includes(0) || !Buffer.from(bytes.toString("utf8"), "utf8").equals(bytes)) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, text: bytes.toString("utf8") };
  } catch (error) {
    return error !== null && typeof error === "object" && (error as NodeJS.ErrnoException).code === "ENOENT"
      ? { ok: false, reason: "missing" }
      : { ok: false, reason: "unavailable" };
  }
}

function dashboardReadFailure(
  status: "missing" | "stale" | "invalid" | "unavailable",
): WorkbenchDashboardReadResultV1 {
  return { status };
}

async function dashboardBindingStatus(
  runtime: Awaited<ReturnType<typeof openRuntime>>,
  input: WorkbenchDashboardReadRequestV1,
): Promise<"ready" | "stale" | "invalid" | "unavailable"> {
  if (
    input.productVersion !== PRODUCT_VERSION ||
    input.repositoryId !== runtime.store.repositoryId ||
    input.worktreeId !== runtime.store.worktreeId
  ) return "invalid";
  try {
    const [snapshot, pulse] = await Promise.all([
      readPublishedSnapshot(runtime.store, input.sourceSnapshotId),
      readPublishedPulse(runtime.store),
    ]);
    if (
      snapshot.snapshot.repositoryId !== input.repositoryId ||
      snapshot.snapshot.worktreeId !== input.worktreeId ||
      snapshot.snapshot.snapshotId !== input.sourceSnapshotId ||
      (snapshot.snapshot.headCommit ?? null) !== input.headCommit
    ) return "invalid";
    if (pulse.pulse.evaluatedSnapshotId !== input.sourceSnapshotId) return "stale";
    return "ready";
  } catch {
    return "unavailable";
  }
}

async function readDashboardJsonFile(
  filePath: string,
  managedRoot: string,
): Promise<{ readonly status: "ready"; readonly value: unknown } | { readonly status: "missing" | "invalid" | "unavailable" }> {
  const read = await readFixedPublishedText(filePath, managedRoot);
  if (!read.ok) return { status: read.reason };
  try {
    return { status: "ready", value: JSON.parse(read.text) as unknown };
  } catch {
    return { status: "invalid" };
  }
}

function publicDashboardMeta(value: unknown, graphNodeCount: number): Record<string, unknown> {
  if (!recordValue(value)) return { version: "alpha", analyzedFiles: graphNodeCount };
  const theme = recordValue(value.theme)
    ? {
        ...(typeof value.theme.presetId === "string" ? { presetId: value.theme.presetId } : {}),
        ...(typeof value.theme.accentId === "string" ? { accentId: value.theme.accentId } : {}),
      }
    : undefined;
  return {
    ...(typeof value.lastAnalyzedAt === "string" ? { lastAnalyzedAt: value.lastAnalyzedAt } : {}),
    ...(typeof value.gitCommitHash === "string" ? { gitCommitHash: value.gitCommitHash } : {}),
    ...(typeof value.version === "string" ? { version: value.version } : {}),
    ...(Number.isSafeInteger(value.analyzedFiles) && (value.analyzedFiles as number) >= 0
      ? { analyzedFiles: value.analyzedFiles }
      : {}),
    ...(theme !== undefined && Object.keys(theme).length > 0 ? { theme } : {}),
  };
}

async function taskDashboardProjection(
  runtime: Awaited<ReturnType<typeof openRuntime>>,
  input: Extract<WorkbenchDashboardReadRequestV1, { kind: "task_brief" | "task_change_check" | "task_verification" }>,
): Promise<WorkbenchDashboardReadResultV1> {
  let context: Awaited<ReturnType<typeof readTaskScopedContext>>;
  try {
    context = await readTaskScopedContext(runtime, input.taskId);
  } catch {
    return dashboardReadFailure("missing");
  }
  const bundle = context.read.bundle;
  if (
    bundle.manifest.repositoryId !== input.repositoryId ||
    bundle.manifest.worktreeId !== input.worktreeId ||
    bundle.manifest.latestSnapshotId !== input.sourceSnapshotId
  ) return dashboardReadFailure("stale");

  const freshness = {
    sourceSnapshotId: input.sourceSnapshotId,
    current: true,
  };
  if (input.kind === "task_brief") {
    if (!("brief" in bundle)) return dashboardReadFailure("missing");
    const items: unknown[] = [];
    let cursor: string | undefined;
    do {
      const page = await runtime.taskEngine.getTaskBrief({
        taskId: input.taskId,
        section: input.section,
        pageSize: 100,
        ...(cursor === undefined ? {} : { cursor }),
      });
      items.push(...page.result.items);
      if (items.length > 4_096) return dashboardReadFailure("invalid");
      cursor = page.nextCursor;
    } while (cursor !== undefined);
    const pulse = await readPublishedPulse(runtime.store);
    return {
      status: "ready",
      json: {
        task: bundle.manifest,
        brief: bundle.brief,
        section: input.section,
        items,
        pulse: projectRepoPulseSurface(pulse.pulse),
        freshness,
      },
    };
  }

  const artifactType = input.kind === "task_change_check" ? "change_check" : "verification";
  const artifact = context.read.artifacts.find((candidate) => candidate.artifactType === artifactType);
  if (artifact === undefined) return dashboardReadFailure("missing");
  return { status: "ready", json: { task: bundle.manifest, artifact, freshness } };
}

const dashboardReader = (
  runtime: Awaited<ReturnType<typeof openRuntime>>,
): WorkbenchDashboardReaderV1 => async (input) => {
  const binding = await dashboardBindingStatus(runtime, input);
  if (binding !== "ready") return dashboardReadFailure(binding);
  if (
    input.kind === "task_brief" ||
    input.kind === "task_change_check" ||
    input.kind === "task_verification"
  ) return taskDashboardProjection(runtime, input);

  const graphRead = await readDashboardJsonFile(
    runtime.store.layout.knowledgeGraph,
    runtime.store.layout.storeRoot,
  );
  if (graphRead.status !== "ready") return dashboardReadFailure(graphRead.status);
  const graphResult = validateGraph(graphRead.value);
  if (!graphResult.success || graphResult.data === undefined || graphResult.issues.length > 0) {
    return dashboardReadFailure("invalid");
  }
  const graph = graphResult.data;
  if (input.headCommit !== null && graph.project.gitCommitHash !== input.headCommit) {
    return dashboardReadFailure("stale");
  }
  if (input.kind === "graph") return { status: "ready", json: graph };
  if (input.kind === "meta") {
    const meta = await readDashboardJsonFile(
      path.join(runtime.store.layout.storeRoot, "meta.json"),
      runtime.store.layout.storeRoot,
    );
    if (meta.status !== "ready") return dashboardReadFailure(meta.status);
    if (
      input.headCommit !== null &&
      recordValue(meta.value) &&
      meta.value.gitCommitHash !== input.headCommit
    ) return dashboardReadFailure("stale");
    return { status: "ready", json: publicDashboardMeta(meta.value, graph.nodes.length) };
  }
  if (input.kind === "config") {
    return { status: "ready", json: { autoUpdate: false, outputLanguage: "zh" } };
  }

  const wikiRead = await readDashboardJsonFile(
    path.join(runtime.store.layout.knowledgeBase, "wiki-index.json"),
    runtime.store.layout.storeRoot,
  );
  if (wikiRead.status !== "ready") return dashboardReadFailure(wikiRead.status);
  const wikiResult = parseWikiIndexV2(wikiRead.value);
  if (!wikiResult.ok) return dashboardReadFailure("invalid");
  const wiki = wikiResult.value;
  if (input.headCommit !== null && wiki.source.gitCommitHash !== input.headCommit) {
    return dashboardReadFailure("stale");
  }
  if (input.kind === "wiki_index") return { status: "ready", json: wiki };
  if (input.kind === "wiki_search") {
    const searchRead = await readDashboardJsonFile(
      path.join(runtime.store.layout.knowledgeBase, "search-index.json"),
      runtime.store.layout.storeRoot,
    );
    if (searchRead.status !== "ready") return dashboardReadFailure(searchRead.status);
    const searchResult = parseWikiSearchIndexV2(searchRead.value);
    if (
      !searchResult.ok ||
      searchResult.value.generatedAt !== wiki.generatedAt ||
      !searchResult.value.records.every((record) =>
        wiki.pages.some((page) => page.id === record.pageId),
      )
    ) return dashboardReadFailure("invalid");
    return { status: "ready", json: searchResult.value };
  }

  if (
    isSensitiveRepositoryPath(input.relativePath) ||
    !wiki.pages.some((page) => page.markdownPath === input.relativePath)
  ) return dashboardReadFailure("missing");
  const pageRead = await readFixedPublishedText(
    path.join(runtime.store.layout.storeRoot, input.relativePath),
    runtime.store.layout.storeRoot,
  );
  if (!pageRead.ok) return dashboardReadFailure(pageRead.reason);
  return {
    status: "ready",
    text: pageRead.text,
    contentType: "text/markdown; charset=utf-8",
  };
};

type WorkbenchTraceRequestLike = {
  readonly surface: "trace";
  readonly taskId: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly snapshotId: string;
};

type WorkbenchTraceResultLike = {
  readonly schemaVersion: 1;
  readonly surface: "trace";
  readonly taskId: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly snapshotId: string;
  readonly status: "ready" | "empty" | "stale" | "unavailable";
  readonly reason?: "not_published" | "invalid_projection" | "read_failed";
  readonly observedSnapshotId?: string;
  readonly changeCheckClassification?: ChangeCheckReadClassificationV1;
  readonly changeCheck?: {
    readonly sourceArtifactId: string;
    readonly id: string;
    readonly taskId: string;
    readonly taskRevision: number;
    readonly baselineSnapshotId: string;
    readonly actualSnapshotId: string;
    readonly generatedAt: string;
    readonly findings: ReadonlyArray<{
      readonly id: string;
      readonly type:
        | "planned_completed"
        | "planned_partial"
        | "unplanned_change"
        | "possible_omission"
        | "verification_gap"
        | "cannot_determine";
      readonly severity: "info" | "warning" | "error" | "critical";
      readonly blocking: boolean;
      readonly resolution: "unresolved" | "fixed" | "accepted";
    }>;
    readonly counts: {
      readonly total: number;
      readonly blocking: number;
      readonly openBlocking: number;
    };
  };
  readonly verification: {
    readonly disposition: "externally_reported";
    readonly records: ReadonlyArray<{
      readonly sourceArtifactId: string;
      readonly sourceRecordId: string;
      readonly taskId: string;
      readonly verificationPlanEntryId: string;
      readonly attempt: number;
      readonly supersedesVerificationRecordId?: string;
      readonly method: "test" | "build" | "lint" | "manual" | "runtime";
      readonly status: "passed" | "failed" | "skipped" | "blocked" | "flaky";
      readonly claimIds: readonly string[];
      readonly snapshotId: string;
      readonly recordedAt: string;
      readonly detailStatus: "legacy_redacted";
      readonly disposition: "externally_reported";
    }>;
    readonly requiredCount: number;
    readonly passedCount: number;
    readonly failedCount: number;
    readonly pendingCount: number;
  };
};

const traceChangeResolution = (
  value: { readonly resolution?: { readonly kind: string } | undefined },
): "unresolved" | "fixed" | "accepted" => {
  if (value.resolution?.kind === "fixed") return "fixed";
  if (value.resolution?.kind === "accepted") return "accepted";
  return "unresolved";
};

const traceReader = (
  runtime: Awaited<ReturnType<typeof openRuntime>>,
): WorkbenchTraceReaderV1 => async (input: WorkbenchTraceRequestLike) => {
  if (input.surface !== "trace") {
    return undefined;
  }
  const context = await readTaskScopedContext(runtime, input.taskId);
  const read = context.read;
  const bundle = read.bundle;
  if (
    bundle.manifest.repositoryId !== input.repositoryId ||
    bundle.manifest.worktreeId !== input.worktreeId
  ) {
    return undefined;
  }
  const traceArtifacts = read.artifacts as ReadonlyArray<{
    readonly artifactType: string;
    readonly artifactId: string;
    readonly sourceSnapshotId: string;
    readonly payload: unknown;
  }>;
  const currentChangeCheckArtifact = [...traceArtifacts]
    .reverse()
    .find((artifact) =>
      artifact.artifactType === "change_check" &&
      artifact.sourceSnapshotId === input.snapshotId,
    );
  const currentVerificationArtifact = [...traceArtifacts]
    .reverse()
    .find((artifact) =>
      artifact.artifactType === "verification" &&
      artifact.sourceSnapshotId === input.snapshotId,
    );
  const traceBundle = bundle as {
    readonly manifest: { readonly taskId: string; readonly latestSnapshotId: string };
    readonly brief?: {
      readonly verificationPlan: readonly {
        readonly id: string;
        readonly required?: boolean;
        readonly acceptanceClaimIds: readonly string[];
      }[];
    };
  };
  if (traceBundle.manifest.latestSnapshotId !== input.snapshotId) {
    return {
      schemaVersion: 1,
      surface: "trace",
      taskId: input.taskId,
      repositoryId: input.repositoryId,
      worktreeId: input.worktreeId,
      snapshotId: input.snapshotId,
      status: "stale",
      observedSnapshotId: bundle.manifest.latestSnapshotId,
      verification: {
        disposition: "externally_reported",
        records: [],
        requiredCount: 0,
        passedCount: 0,
        failedCount: 0,
        pendingCount: 0,
      },
    };
  }

  const changeCheck = currentChangeCheckArtifact?.payload as
    | ChangeCheckV1
    | undefined;
  const verificationRecords = (
    currentVerificationArtifact?.payload as
      | { readonly records: ReadonlyArray<{
          readonly id: string;
          readonly taskId: string;
          readonly verificationPlanEntryId: string;
          readonly attempt: number;
          readonly supersedesVerificationRecordId?: string;
          readonly kind: "test" | "build" | "lint" | "manual" | "runtime";
          readonly status: "passed" | "failed" | "skipped" | "blocked" | "flaky";
          readonly claimIds: readonly string[];
          readonly skipAcceptance?: unknown;
          readonly snapshotId: string;
          readonly recordedAt: string;
        }> }
      | undefined
  )?.records.filter((record) => record.snapshotId === input.snapshotId) ?? [];
  const requiredPlanEntries = new Map(
    traceBundle.brief?.verificationPlan
      .filter((entry) => entry.required !== false)
      .map((entry) => [entry.id, entry] as const) ?? [],
  );
  const requiredVerificationRecords = verificationRecords.filter((record) =>
    requiredPlanEntries.has(record.verificationPlanEntryId),
  );
  const latestRequiredVerificationRecords = new Map<
    string,
    (typeof requiredVerificationRecords)[number]
  >();
  for (const record of requiredVerificationRecords) {
    const current = latestRequiredVerificationRecords.get(
      record.verificationPlanEntryId,
    );
    if (current === undefined || current.attempt < record.attempt) {
      latestRequiredVerificationRecords.set(
        record.verificationPlanEntryId,
        record,
      );
    }
  }
  const latestRequiredAttempts = [...latestRequiredVerificationRecords.values()];
  const passedCount = latestRequiredAttempts.filter((record) => {
    const planEntry = requiredPlanEntries.get(record.verificationPlanEntryId)!;
    const recordClaimIds = new Set(record.claimIds);
    const hasExactAcceptanceCoverage =
      recordClaimIds.size === record.claimIds.length &&
      recordClaimIds.size === planEntry.acceptanceClaimIds.length &&
      planEntry.acceptanceClaimIds.every((claimId) => recordClaimIds.has(claimId));
    return hasExactAcceptanceCoverage && (
      record.status === "passed" ||
      (record.status === "skipped" && record.skipAcceptance !== undefined)
    );
  }).length;
  const failedCount = latestRequiredAttempts.filter((record) =>
    record.status === "failed" ||
    record.status === "blocked" ||
    record.status === "flaky",
  ).length;
  const pendingCount = Math.max(
    0,
    requiredPlanEntries.size - passedCount - failedCount,
  );
  const result: WorkbenchTraceResultLike = {
    schemaVersion: 1,
    surface: "trace",
    taskId: input.taskId,
    repositoryId: input.repositoryId,
    worktreeId: input.worktreeId,
    snapshotId: input.snapshotId,
    status: changeCheck === undefined && verificationRecords.length === 0 ? "empty" : "ready",
    ...(changeCheck === undefined ? {} : {
      changeCheckClassification: classifyChangeCheckV1(changeCheck),
      changeCheck: {
        sourceArtifactId: currentChangeCheckArtifact!.artifactId,
        id: changeCheck.id,
        taskId: changeCheck.taskId,
        taskRevision: changeCheck.taskRevision,
        baselineSnapshotId: changeCheck.baselineSnapshotId,
        actualSnapshotId: changeCheck.actualSnapshotId,
        generatedAt: changeCheck.generatedAt,
        findings: changeCheck.findings.map((finding) => ({
          id: finding.id,
          type: finding.type,
          severity: finding.severity,
          blocking: finding.blocking,
          resolution: traceChangeResolution(finding),
        })),
        counts: {
          total: changeCheck.findings.length,
          blocking: changeCheck.findings.filter((finding: { readonly blocking: boolean }) => finding.blocking).length,
          openBlocking: changeCheck.findings.filter(
            (finding: { readonly blocking: boolean; readonly resolution?: { readonly kind: string } }) =>
              finding.blocking && traceChangeResolution(finding) === "unresolved",
          ).length,
        },
      },
    }),
    verification: {
      disposition: "externally_reported",
      records: verificationRecords.map((record) => ({
        sourceArtifactId: currentVerificationArtifact!.artifactId,
        sourceRecordId: record.id,
        taskId: record.taskId,
        verificationPlanEntryId: record.verificationPlanEntryId,
        attempt: record.attempt,
        ...(record.supersedesVerificationRecordId === undefined ? {} : {
          supersedesVerificationRecordId: record.supersedesVerificationRecordId,
        }),
        method: record.kind,
        status: record.status,
        claimIds: [...record.claimIds],
        snapshotId: record.snapshotId,
        recordedAt: record.recordedAt,
        detailStatus: "legacy_redacted",
        disposition: "externally_reported",
      })),
      requiredCount: requiredPlanEntries.size,
      passedCount,
      failedCount,
      pendingCount,
    },
  };
  return result;
};

/**
 * The Workbench source projection is deliberately narrower than get_evidence:
 * it can only resolve a file-backed Evidence item from the same, published
 * Task bundle and snapshot that authenticated the browser session.  The
 * callback never accepts a path or a commit from the browser.
 */
const WORKBENCH_SOURCE_MAX_BYTES = 1 * 1024 * 1024;
const WORKBENCH_SOURCE_PREVIEW_MAX_BYTES = 256 * 1024;

type WorkbenchEvidenceRecord = Extract<
  WorkbenchEvidenceResultV1,
  { readonly status: "ready" }
>["evidence"];

type FileEvidenceLike = {
  readonly id: string;
  readonly kind: "source" | "config" | "test" | "document";
  readonly epistemicStatus: "observed" | "inferred";
  readonly freshness: string;
  readonly nodeIds: readonly string[];
  readonly filePath: string;
  readonly lineRange?: readonly [number, number];
  readonly contentHash: string;
  readonly observedAtSnapshotId: string;
  readonly commit?: string;
};

function workbenchEvidenceBase(input: WorkbenchEvidenceRequestV1) {
  return {
    schemaVersion: 1 as const,
    surface: "evidence" as const,
    taskId: input.taskId,
    evidenceId: input.evidenceId,
    repositoryId: input.repositoryId,
    worktreeId: input.worktreeId,
    snapshotId: input.snapshotId,
    headCommit: input.headCommit,
  };
}

function workbenchEvidenceNotReady(
  input: WorkbenchEvidenceRequestV1,
  status: "stale" | "invalid" | "unavailable" | "redacted",
  reason:
    | "not_published"
    | "not_found"
    | "snapshot_mismatch"
    | "evidence_stale"
    | "evidence_invalid"
    | "source_unanchored"
    | "source_missing"
    | "content_changed"
    | "sensitive"
    | "binary"
    | "too_large"
    | "read_failed"
    | "redacted",
  extra: Readonly<Record<string, unknown>> = {},
): WorkbenchEvidenceResultV1 {
  return {
    ...workbenchEvidenceBase(input),
    status,
    reason,
    ...extra,
  } as WorkbenchEvidenceResultV1;
}

function isSafeWorkbenchRelativePath(value: string): boolean {
  if (
    value.length === 0 ||
    value.startsWith("/") ||
    /^[A-Za-z]:/u.test(value) ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return false;
  }
  return !value.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..");
}

function isBinaryWorkbenchSource(bytes: Buffer): boolean {
  if (bytes.includes(0)) return true;
  const text = bytes.toString("utf8");
  // Invalid UTF-8 is decoded with replacement characters by Buffer.  A
  // round-trip mismatch is a conservative binary guard without exposing raw
  // bytes through the browser projection.
  return !Buffer.from(text, "utf8").equals(bytes);
}

function workbenchSourceReadFailure(
  error: unknown,
): { readonly status: "unavailable" | "redacted"; readonly reason: "source_missing" | "too_large" | "read_failed" | "redacted" } {
  const code =
    error !== null && typeof error === "object" && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined;
  if (code === "too_large") return { status: "redacted", reason: "too_large" };
  if (code === "symlink_path" || code === "outside_repository") {
    return { status: "redacted", reason: "redacted" };
  }
  if (code === "ENOENT" || code === "not_found") {
    return { status: "unavailable", reason: "source_missing" };
  }
  return { status: "unavailable", reason: "read_failed" };
}

const evidenceReader = (
  runtime: Awaited<ReturnType<typeof openRuntime>>,
  canonicalRoot: string,
): WorkbenchEvidenceReaderV1 => async (input) => {
  const base = workbenchEvidenceBase(input);
  if (
    runtime.store.repositoryId !== input.repositoryId ||
    runtime.store.worktreeId !== input.worktreeId
  ) {
    return workbenchEvidenceNotReady(input, "invalid", "snapshot_mismatch");
  }

  let context: Awaited<ReturnType<typeof readTaskScopedContext>>;
  try {
    context = await readTaskScopedContext(runtime, input.taskId);
  } catch {
    // Do not turn artifact-store errors into a filesystem or root-path oracle.
    return workbenchEvidenceNotReady(input, "unavailable", "not_published");
  }
  const bundle = context.read.bundle;
  const manifest = bundle.manifest;
  if (
    manifest.taskId !== input.taskId ||
    manifest.repositoryId !== input.repositoryId ||
    manifest.worktreeId !== input.worktreeId
  ) {
    return workbenchEvidenceNotReady(input, "invalid", "snapshot_mismatch");
  }

  const observedSnapshotId = manifest.latestSnapshotId;
  const snapshot = context.publishedSnapshot.snapshot;
  if (
    observedSnapshotId !== input.snapshotId ||
    snapshot.snapshotId !== input.snapshotId ||
    snapshot.repositoryId !== input.repositoryId ||
    snapshot.worktreeId !== input.worktreeId ||
    (snapshot.headCommit ?? null) !== input.headCommit
  ) {
    return workbenchEvidenceNotReady(input, "stale", "snapshot_mismatch", {
      observedSnapshotId,
    });
  }

  const evidenceArtifact = context.read.artifacts.find(
    (artifact) => artifact.artifactType === "evidence_ledger",
  );
  if (
    evidenceArtifact === undefined ||
    evidenceArtifact.taskId !== input.taskId ||
    evidenceArtifact.repositoryId !== input.repositoryId ||
    evidenceArtifact.worktreeId !== input.worktreeId ||
    evidenceArtifact.sourceSnapshotId !== input.snapshotId
  ) {
    return workbenchEvidenceNotReady(input, "invalid", "snapshot_mismatch");
  }
  if (!("evidence" in bundle) || !Array.isArray(bundle.evidence)) {
    return workbenchEvidenceNotReady(input, "unavailable", "not_published");
  }

  const item = bundle.evidence.find((candidate) => candidate.id === input.evidenceId);
  if (item === undefined) {
    return workbenchEvidenceNotReady(input, "unavailable", "not_found");
  }
  if (!("filePath" in item) || !("contentHash" in item)) {
    return workbenchEvidenceNotReady(input, "invalid", "source_unanchored");
  }
  const sourceEvidence = item as FileEvidenceLike;
  if (
    !["source", "config", "test", "document"].includes(sourceEvidence.kind) ||
    !["observed", "inferred"].includes(sourceEvidence.epistemicStatus) ||
    !/^sha256:[0-9a-f]{64}$/u.test(sourceEvidence.contentHash)
  ) {
    return workbenchEvidenceNotReady(input, "invalid", "evidence_invalid");
  }
  if (sourceEvidence.observedAtSnapshotId !== input.snapshotId) {
    return workbenchEvidenceNotReady(input, "stale", "evidence_stale", {
      observedSnapshotId: sourceEvidence.observedAtSnapshotId,
    });
  }
  if (sourceEvidence.freshness !== "current") {
    return workbenchEvidenceNotReady(input, "stale", "evidence_stale");
  }
  if (
    sourceEvidence.commit !== undefined &&
    sourceEvidence.commit !== input.headCommit
  ) {
    return workbenchEvidenceNotReady(input, "stale", "snapshot_mismatch", {
      observedSnapshotId: sourceEvidence.observedAtSnapshotId,
    });
  }
  if (
    !isSafeWorkbenchRelativePath(sourceEvidence.filePath) ||
    isSensitiveRepositoryPath(sourceEvidence.filePath) ||
    sourceEvidence.filePath === ".understand-code" ||
    sourceEvidence.filePath.startsWith(".understand-code/")
  ) {
    return workbenchEvidenceNotReady(input, "redacted", "sensitive");
  }

  let bytes: Buffer;
  try {
    bytes = await readStableRepositoryFile(
      canonicalRoot,
      sourceEvidence.filePath,
      WORKBENCH_SOURCE_MAX_BYTES,
    );
  } catch (error) {
    const failure = workbenchSourceReadFailure(error);
    return workbenchEvidenceNotReady(input, failure.status, failure.reason);
  }
  if (isBinaryWorkbenchSource(bytes)) {
    return workbenchEvidenceNotReady(input, "redacted", "binary");
  }
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (digest !== sourceEvidence.contentHash) {
    return workbenchEvidenceNotReady(input, "invalid", "content_changed");
  }

  const text = bytes.toString("utf8");
  if (text.includes(canonicalRoot)) {
    return workbenchEvidenceNotReady(input, "redacted", "redacted");
  }
  const lines = text.split(/\r\n|\n|\r/u);
  const requestedRange = sourceEvidence.lineRange;
  const lineRange: readonly [number, number] = [
    requestedRange?.[0] ?? 1,
    requestedRange?.[1] ?? Math.max(1, lines.length),
  ];
  if (
    lineRange[0] < 1 ||
    lineRange[1] < lineRange[0] ||
    lineRange[1] > lines.length
  ) {
    return workbenchEvidenceNotReady(input, "invalid", "source_unanchored");
  }
  const content = lines.slice(lineRange[0] - 1, lineRange[1]).join("\n");
  const sizeBytes = Buffer.byteLength(content, "utf8");
  if (sizeBytes > WORKBENCH_SOURCE_PREVIEW_MAX_BYTES) {
    return workbenchEvidenceNotReady(input, "redacted", "too_large");
  }
  let nodeIds = [...sourceEvidence.nodeIds];
  if (nodeIds.length === 0) {
    const graphRead = await readFixedPublishedJson(
      runtime.store.layout.knowledgeGraph,
      runtime.store.layout.storeRoot,
    );
    if (graphRead.ok) {
      const graphResult = validateGraph(graphRead.value);
      if (
        graphResult.success &&
        graphResult.data !== undefined &&
        (input.headCommit === null || graphResult.data.project.gitCommitHash === input.headCommit)
      ) {
        nodeIds = graphResult.data.nodes
          .filter((node) => {
            if (node.filePath !== sourceEvidence.filePath) return false;
            if (node.lineRange === undefined) return true;
            return node.lineRange[0] <= lineRange[1] && node.lineRange[1] >= lineRange[0];
          })
          .map((node) => node.id)
          .sort((left, right) => left.localeCompare(right, "en"))
          .slice(0, 256);
      }
    }
  }
  const evidence: WorkbenchEvidenceRecord = {
    id: sourceEvidence.id,
    kind: sourceEvidence.kind,
    epistemicStatus: sourceEvidence.epistemicStatus,
    freshness: "current",
    nodeIds,
    filePath: sourceEvidence.filePath,
    lineRange,
    contentHash: digest as `sha256:${string}`,
    observedAtSnapshotId: sourceEvidence.observedAtSnapshotId,
  };
  return {
    ...base,
    status: "ready",
    evidence,
    source: {
      filePath: sourceEvidence.filePath,
      lineRange,
      content,
      sizeBytes,
      lineCount: content === "" ? 0 : lineRange[1] - lineRange[0] + 1,
      truncated: false,
    },
  };
};

async function openWorkbench(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = OpenWorkbenchInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  if (parsed.data.openBrowser === true) {
    throw new ToolFailure(
      invalidArgumentFailure(["openBrowser"], "browser_launch_not_supported"),
    );
  }

  // A legacy Task/Workbench session carries repository, worktree, Snapshot,
  // Check, and Verification lineage that has no accepted public projection.
  // Do not open the legacy Store or start a browser session until the strong
  // Store can validate and project that lineage.
  failStrongStoreUnavailableV1();

  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  if (parsed.data.route.taskId !== undefined) {
    const manifest = await runtime.store.readManifest({ verifyArtifacts: false });
    const taskExists = manifest.artifacts.some(
      (descriptor) =>
        descriptor.artifactType === "task_manifest" &&
        descriptor.taskId === parsed.data.route.taskId,
    );
    if (!taskExists) {
      throw new ToolFailure(
        resourceNotFoundFailure("task", parsed.data.route.taskId),
      );
    }
  }

  const [published, workbenchUi] = await Promise.all([
    readPublishedPulse(runtime.store),
    resolveWorkbenchUi(),
  ]);
  const workbenchUiOptions = "dashboardBundle" in workbenchUi
    ? {
        dashboardBundle: workbenchUi.dashboardBundle,
        dashboardReader: dashboardReader(runtime),
      }
    : workbenchUi;
  const session = await openWorkbenchSessionV1(parsed.data, {
    canonicalRoot,
    productVersion: PRODUCT_VERSION,
    repositoryId: published.snapshot.snapshot.repositoryId,
    worktreeId: published.snapshot.snapshot.worktreeId,
    sourceSnapshotId: published.snapshot.snapshot.snapshotId,
    headCommit: published.snapshot.snapshot.headCommit ?? null,
    worktreeFingerprint: published.snapshot.worktreeFingerprint,
    freshness: published.pulse.status,
    ...workbenchUiOptions,
    taskBriefReader: async (input) => {
      const page = await runtime.taskEngine.getTaskBrief(input);
      return {
        result: page.result,
        total: page.total,
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      };
    },
    graphReader: graphContextReader(runtime),
    knowledgeReader: knowledgeContextReader(runtime),
    traceReader: traceReader(runtime),
    evidenceReader: evidenceReader(runtime, canonicalRoot),
  } as Parameters<typeof openWorkbenchSessionV1>[1]);
  return OpenWorkbenchOutputV1Schema.parse({
    ...session.output,
    structuredContent: {
      ...session.output.structuredContent,
      meta: {
        ...session.output.structuredContent.meta,
        durationMs: elapsed(startedAt),
      },
    },
  });
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

const taskGateTargets: ReadonlySet<string> = new Set([
  "context_ready",
  "planned",
  "in_progress",
  "check_required",
  "verification_required",
  "verified",
]);

const taskGateGuardCodes: ReadonlySet<string> = new Set([
  "context_not_ready",
  "target_snapshot_mismatch",
  "target_snapshot_not_current",
  "pulse_snapshot_mismatch",
  "baseline_snapshot_mismatch",
  "goal_not_confirmed",
  "acceptance_not_confirmed",
  "plan_not_confirmed",
  "worktree_binding_invalid",
  "snapshot_not_current",
  "current_check_required",
  "blocking_finding",
  "verification_required",
  "verification_failed",
  "verification_blocked",
  "verification_flaky",
  "freshness_invalid",
  "blocker_unresolved",
]);

function mappedTaskEngineFailure(error: TaskEngineError): McpToolErrorResultV1 | undefined {
  if (error.code === "artifact_unavailable") {
    const artifactType =
      typeof error.details?.artifactType === "string"
        ? error.details.artifactType
        : "repository_context";
    if (artifactType === "repository_snapshot" || artifactType === "repo_pulse") {
      return repositoryNotReadyFailure(
        "not_ready",
        [artifactType],
        "refresh_index",
      );
    }
    return artifactUnavailableFailure("missing", artifactType);
  }
  if (error.code === "task_gate_unsatisfied") {
    const taskId = error.details?.taskId;
    const targetStatus = error.details?.targetStatus;
    const failedGuards = error.details?.failedGuards;
    if (
      typeof taskId === "string" &&
      typeof targetStatus === "string" &&
      taskGateTargets.has(targetStatus) &&
      Array.isArray(failedGuards) &&
      failedGuards.length > 0 &&
      failedGuards.every(
        (guard) =>
          guard !== null &&
          typeof guard === "object" &&
          typeof (guard as { code?: unknown }).code === "string" &&
          taskGateGuardCodes.has((guard as { code: string }).code) &&
          ((guard as { resourceId?: unknown }).resourceId === undefined ||
            typeof (guard as { resourceId?: unknown }).resourceId === "string"),
      )
    ) {
      return taskGateFailure(
        taskId,
        targetStatus as Parameters<typeof taskGateFailure>[1],
        failedGuards as Parameters<typeof taskGateFailure>[2],
      );
    }
  }
  if (error.code === "idempotency_conflict") {
    const key = error.details?.idempotencyKey;
    const requestDigest = error.details?.requestDigest;
    const existingRequestDigest = error.details?.existingRequestDigest;
    if (
      typeof key === "string" &&
      isDigest(requestDigest) &&
      isDigest(existingRequestDigest)
    ) {
      return idempotencyConflictFailure(key, requestDigest, existingRequestDigest);
    }
  }
  if (error.code === "invalid_cursor") {
    return invalidArgumentFailure(["cursor"], "invalid_cursor");
  }
  if (error.code === "context_build_failed") {
    const cause = error.cause;
    if (cause instanceof RepositoryTaskContextProviderError) {
      switch (cause.code) {
        case "repository_file_unavailable":
          return artifactUnavailableFailure("missing", "task_context");
        case "repository_file_changed":
          return artifactUnavailableFailure("stale", "task_context");
        case "repository_file_too_large":
          return sourceAccessDeniedFailure("too_large");
        case "unsafe_repository_path":
          return sourceAccessDeniedFailure("symlink_escape");
        case "invalid_graph":
          return artifactUnavailableFailure("corrupt", "knowledge_graph");
      }
    }
  }
  return undefined;
}

function mappedArtifactStoreFailure(
  error: ArtifactStoreError,
  toolName: ImplementedToolName,
  argumentsValue: unknown,
): McpToolErrorResultV1 | undefined {
  if (error.code === "artifact_not_found") {
    if (
      (toolName === "get_task_brief" ||
        toolName === "get_evidence" ||
        toolName === "search_context" ||
        toolName === "trace_impact") &&
      argumentsValue !== null &&
      typeof argumentsValue === "object" &&
      typeof (argumentsValue as { taskId?: unknown }).taskId === "string"
    ) {
      return resourceNotFoundFailure(
        "task",
        (argumentsValue as { taskId: string }).taskId,
      );
    }
    return repositoryNotReadyFailure(
      "not_ready",
      ["repository_context"],
      "refresh_index",
    );
  }
  if (
    error.code === "artifact_corrupt" ||
    error.code === "manifest_inconsistent" ||
    error.code === "reference_integrity_failed"
  ) {
    if (
      toolName === "get_task_brief" ||
      toolName === "get_evidence" ||
      toolName === "search_context" ||
      toolName === "trace_impact"
    ) {
      return artifactUnavailableFailure("corrupt", "task_context");
    }
    return artifactUnavailableFailure("corrupt", "repository_context");
  }
  return undefined;
}

export async function callImplementedTool(
  toolName: ImplementedToolName,
  argumentsValue: unknown,
  canonicalRoot: string,
): Promise<unknown> {
  try {
    switch (toolName) {
      case "get_repo_pulse":
        return await getRepoPulse(argumentsValue, canonicalRoot);
      case "build_task_brief":
        return await buildTaskBrief(argumentsValue, canonicalRoot);
      case "get_task_brief":
        return await getTaskBrief(argumentsValue, canonicalRoot);
      case "update_task":
        return await updateTask(argumentsValue, canonicalRoot);
      case "check_change":
        return await checkChange(argumentsValue, canonicalRoot);
      case "record_verification":
        return await recordVerification(argumentsValue, canonicalRoot);
      case "open_workbench":
        return await openWorkbench(argumentsValue, canonicalRoot);
      case "get_evidence":
        return await getEvidence(argumentsValue, canonicalRoot);
      case "search_context":
        return await searchContext(argumentsValue, canonicalRoot);
      case "trace_impact":
        return await traceImpact(argumentsValue, canonicalRoot);
      case "refresh_index":
        return await refreshIndex(argumentsValue, canonicalRoot);
    }
  } catch (error) {
    if (error instanceof ToolFailure) return error.result;
    if (error instanceof TaskEngineError) {
      return mappedTaskEngineFailure(error) ?? internalErrorFailure();
    }
    if (error instanceof ArtifactStoreError) {
      return (
        mappedArtifactStoreFailure(error, toolName, argumentsValue) ??
        internalErrorFailure()
      );
    }
    throw error;
  }
}
