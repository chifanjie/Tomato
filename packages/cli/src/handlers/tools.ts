import { performance } from "node:perf_hooks";

import { ArtifactStoreError } from "@understand-code/artifact-store";
import {
  CheckChangeInputV1Schema,
  RecordVerificationInputV1Schema,
} from "@understand-code/contracts";
import {
  BuildTaskBriefInputV1Schema,
  BuildTaskBriefOutputV1Schema,
  CheckChangeOutputV1Schema,
  GetRepoPulseInputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefInputV1Schema,
  GetTaskBriefOutputV1Schema,
  OpenWorkbenchInputV1Schema,
  OpenWorkbenchOutputV1Schema,
  RecordVerificationOutputV1Schema,
  type McpToolErrorResultV1,
} from "@understand-code/contracts/mcp";
import {
  RepositoryTaskContextProviderError,
  TaskEngineError,
} from "@understand-code/task-engine";
import { openWorkbenchSessionV1 } from "@understand-code/workbench-runtime";

import { PRODUCT_VERSION } from "../constants.js";
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
  "check_change",
  "record_verification",
  "open_workbench",
] as const);

export type ImplementedToolName = (typeof IMPLEMENTED_TOOL_NAMES)[number];

function elapsed(startedAt: number): number {
  return Math.max(0, performance.now() - startedAt);
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
  return GetRepoPulseOutputV1Schema.parse({
    isError: false,
    content: [{ type: "text", text: "Repository pulse loaded." }],
    structuredContent: {
      schemaVersion: 1,
      meta: successMeta(
        published.snapshot,
        published.pulse.status,
        elapsed(startedAt),
        { cacheHit: true },
      ),
      result: { pulse: published.pulse },
    },
  });
}

async function buildTaskBrief(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = BuildTaskBriefInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
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

async function checkChange(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = CheckChangeInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  const startedAt = performance.now();
  const runtime = await openRuntime(canonicalRoot);
  const manifest = await runtime.store.readManifest({ verifyArtifacts: false });
  const latestSnapshotId = manifest.artifacts
    .filter((descriptor) => descriptor.artifactType === "task_manifest")
    .find((descriptor) => descriptor.taskId === parsed.data.taskId)
    ?.sourceSnapshotId;
  const actualSnapshotId = parsed.data.actualSnapshotId ?? latestSnapshotId;
  if (actualSnapshotId === undefined) {
    throw new ToolFailure(resourceNotFoundFailure("task", parsed.data.taskId));
  }
  const result = await runtime.taskEngine.checkChange(
    { ...parsed.data, actualSnapshotId },
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
    content: [{ type: "text", text: "Change Check recorded." }],
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

async function openWorkbench(argumentsValue: unknown, canonicalRoot: string) {
  const parsed = OpenWorkbenchInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  if (parsed.data.openBrowser === true) {
    throw new ToolFailure(
      invalidArgumentFailure(["openBrowser"], "browser_launch_not_supported"),
    );
  }

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

  const published = await readPublishedPulse(runtime.store);
  const session = await openWorkbenchSessionV1(parsed.data, {
    canonicalRoot,
    productVersion: PRODUCT_VERSION,
    repositoryId: published.snapshot.snapshot.repositoryId,
    worktreeId: published.snapshot.snapshot.worktreeId,
    sourceSnapshotId: published.snapshot.snapshot.snapshotId,
    headCommit: published.snapshot.snapshot.headCommit ?? null,
    worktreeFingerprint: published.snapshot.worktreeFingerprint,
    freshness: published.pulse.status,
    taskBriefReader: async (input) => {
      const page = await runtime.taskEngine.getTaskBrief(input);
      return {
        result: page.result,
        total: page.total,
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      };
    },
  });
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
    const failedGuards = error.details?.failedGuards;
    if (
      typeof taskId === "string" &&
      Array.isArray(failedGuards) &&
      failedGuards.every(
        (guard) =>
          guard !== null &&
          typeof guard === "object" &&
          (guard as { code?: unknown }).code === "context_not_ready" &&
          ((guard as { resourceId?: unknown }).resourceId === undefined ||
            typeof (guard as { resourceId?: unknown }).resourceId === "string"),
      )
    ) {
      return taskGateFailure(
        taskId,
        "context_ready",
        failedGuards as { code: "context_not_ready"; resourceId?: string }[],
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
      toolName === "get_task_brief" &&
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
      case "check_change":
        return await checkChange(argumentsValue, canonicalRoot);
      case "record_verification":
        return await recordVerification(argumentsValue, canonicalRoot);
      case "open_workbench":
        return await openWorkbench(argumentsValue, canonicalRoot);
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
