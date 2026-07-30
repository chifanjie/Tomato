import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  TaskEventV1Schema,
  canonicalizeJson,
  parseTrustedTaskArtifactBundleV1,
  verifyTaskEventLogIntegrityV1,
  type TaskArtifactBundleV1,
  type TaskEventV1,
} from "@understand-code/contracts";

import {
  atomicWriteFile,
  readManagedFile,
  type AtomicWriteOptions,
} from "./atomic.js";
import { digestCanonicalJson, sha256Bytes } from "./digest.js";
import { ArtifactStoreError } from "./errors.js";
import type { ArtifactStoreLayout } from "./layout.js";
import {
  withStoreLock,
  type LockAcquireOptions,
  type StoreLockLease,
} from "./lock.js";
import {
  ensureManagedDirectory,
  repositoryRelativePathFromAbsolute,
} from "./path-guard.js";

export interface ParsedTaskEventLog {
  readonly events: TaskEventV1[];
  readonly serializedCompleteLog: string;
  readonly contentDigest: ReturnType<typeof sha256Bytes>;
  readonly truncatedTail?: string;
}

function verifyLifecycleContinuity(events: readonly TaskEventV1[]): void {
  events.forEach((event, index) => {
    const previous = events[index - 1];
    if (index === 0) {
      if (
        event.revision !== 1 ||
        event.previousRevision !== 0 ||
        event.previousStatus !== undefined ||
        event.resultingStatus !== "created" ||
        event.action.type !== "task_created"
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Task event log does not begin with the canonical genesis event.",
          { eventId: event.eventId },
        );
      }
      return;
    }
    if (
      previous === undefined ||
      event.previousRevision !== previous.revision ||
      event.revision !== previous.revision + 1 ||
      event.previousStatus !== previous.resultingStatus ||
      Date.parse(event.occurredAt) < Date.parse(previous.occurredAt)
    ) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Task event revision, lifecycle, or timestamp continuity is broken.",
        { eventId: event.eventId, eventIndex: index },
      );
    }
  });
}

function verifyEventIdUniqueness(
  events: readonly TaskEventV1[],
): void {
  const eventIds = new Set<string>();
  events.forEach((event, eventIndex) => {
    if (eventIds.has(event.eventId)) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Task event log contains a duplicate eventId.",
        { eventId: event.eventId, eventIndex },
      );
    }
    eventIds.add(event.eventId);
  });
}

export function parseTaskEventLogText(text: string): ParsedTaskEventLog {
  if (text.length === 0) {
    return {
      events: [],
      serializedCompleteLog: "",
      contentDigest: sha256Bytes(""),
    };
  }

  const endsWithNewline = text.endsWith("\n");
  const rawLines = text.split("\n");
  const completeLines = endsWithNewline
    ? rawLines.slice(0, -1)
    : rawLines.slice(0, -1);
  const truncatedTail = endsWithNewline
    ? undefined
    : rawLines.at(-1) ?? "";
  if (completeLines.some((line) => line.length === 0)) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Task event log contains a blank complete line.",
    );
  }

  const events = completeLines.map((line, index) => {
    let input: unknown;
    try {
      input = JSON.parse(line) as unknown;
    } catch (error) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Task event log contains malformed complete JSON.",
        { line: index + 1 },
        { cause: error },
      );
    }
    try {
      const event = TaskEventV1Schema.parse(input);
      if (line !== canonicalizeJson(event)) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Task event log contains a non-canonical complete JSON line.",
          { line: index + 1 },
        );
      }
      return event;
    } catch (error) {
      if (error instanceof ArtifactStoreError) throw error;
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Task event log contains an invalid TaskEventV1.",
        { line: index + 1 },
        { cause: error },
      );
    }
  });

  const integrity = verifyTaskEventLogIntegrityV1(
    events,
    digestCanonicalJson,
  );
  if (!integrity.valid) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Task event digest chain is invalid.",
      { issues: integrity.issues },
    );
  }
  verifyEventIdUniqueness(events);
  verifyLifecycleContinuity(events);
  const serializedCompleteLog =
    events.length === 0
      ? ""
      : `${events.map((event) => canonicalizeJson(event)).join("\n")}\n`;
  return {
    events,
    serializedCompleteLog,
    contentDigest: sha256Bytes(serializedCompleteLog),
    ...(truncatedTail === undefined ? {} : { truncatedTail }),
  };
}

export async function readTaskEventLog(
  layout: ArtifactStoreLayout,
  taskId: string,
): Promise<ParsedTaskEventLog> {
  const eventsPath = layout.task(taskId).events;
  try {
    const bytes = await readManagedFile(layout.worktreeRoot, eventsPath);
    return parseTaskEventLogText(bytes.toString("utf8"));
  } catch (error) {
    if (
      error instanceof ArtifactStoreError &&
      error.code === "artifact_not_found"
    ) {
      return parseTaskEventLogText("");
    }
    throw error;
  }
}

export interface AppendTaskEventOptions extends AtomicWriteOptions {
  lock?: LockAcquireOptions;
  /** @internal ArtifactStore uses this to keep Task -> repository lock order. */
  taskLockLease?: StoreLockLease;
}

export interface AppendTaskEventResult extends ParsedTaskEventLog {
  readonly repairedTruncatedTail: boolean;
  readonly replayed: boolean;
}

export async function appendTaskEvent(
  layout: ArtifactStoreLayout,
  taskId: string,
  eventInput: unknown,
  options: AppendTaskEventOptions = {},
): Promise<AppendTaskEventResult> {
  const event = TaskEventV1Schema.parse(eventInput);
  const taskLayout = layout.task(taskId);
  if (event.taskId !== taskId) {
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      "Task event does not belong to the requested Task.",
      { taskId, eventTaskId: event.taskId },
    );
  }

  const appendWhileLocked = async (): Promise<AppendTaskEventResult> => {
      const current = await readTaskEventLog(layout, taskId);
      const existing = current.events.find(
        (candidate) => candidate.eventId === event.eventId,
      );
      if (existing !== undefined) {
        if (canonicalizeJson(existing) !== canonicalizeJson(event)) {
          throw new ArtifactStoreError(
            "idempotency_conflict",
            "The same eventId was used for different event content.",
            { eventId: event.eventId },
          );
        }
        let repairedTruncatedTail = false;
        if (current.truncatedTail !== undefined) {
          const quarantineDirectory = await ensureManagedDirectory(
            layout.worktreeRoot,
            ".understand-code/.recovery/quarantine/events",
          );
          const quarantinePath = path.join(
            quarantineDirectory,
            `${taskId}-${Date.now()}-${randomUUID()}.jsonl.partial`,
          );
          await atomicWriteFile(
            layout.worktreeRoot,
            quarantinePath,
            `${current.serializedCompleteLog}${current.truncatedTail}`,
          );
          await atomicWriteFile(
            layout.worktreeRoot,
            taskLayout.events,
            current.serializedCompleteLog,
            options,
          );
          repairedTruncatedTail = true;
        }
        return {
          ...current,
          ...(repairedTruncatedTail ? { truncatedTail: undefined } : {}),
          repairedTruncatedTail,
          replayed: true,
        };
      }

      const previous = current.events.at(-1);
      if (
        (previous === undefined &&
          (event.revision !== 1 ||
            event.previousRevision !== 0 ||
            event.previousEventDigest !== undefined)) ||
        (previous !== undefined &&
          (event.revision !== previous.revision + 1 ||
            event.previousRevision !== previous.revision ||
            event.previousEventDigest !== previous.eventDigest ||
            event.previousStatus !== previous.resultingStatus))
      ) {
        throw new ArtifactStoreError(
          "revision_conflict",
          "Task event does not extend the current event-log head.",
          {
            eventId: event.eventId,
            expectedRevision: (previous?.revision ?? 0) + 1,
            actualRevision: event.revision,
          },
        );
      }

      const combinedEvents = [...current.events, event];
      const combinedIntegrity = verifyTaskEventLogIntegrityV1(
        combinedEvents,
        digestCanonicalJson,
      );
      if (!combinedIntegrity.valid) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Appended Task event has an invalid digest chain.",
          { issues: combinedIntegrity.issues },
        );
      }
      verifyLifecycleContinuity(combinedEvents);

      let repairedTruncatedTail = false;
      if (current.truncatedTail !== undefined) {
        const quarantineDirectoryRelative =
          ".understand-code/.recovery/quarantine/events";
        const quarantineDirectory = await ensureManagedDirectory(
          layout.worktreeRoot,
          quarantineDirectoryRelative,
        );
        const quarantinePath = path.join(
          quarantineDirectory,
          `${taskId}-${Date.now()}-${randomUUID()}.jsonl.partial`,
        );
        await atomicWriteFile(
          layout.worktreeRoot,
          quarantinePath,
          `${current.serializedCompleteLog}${current.truncatedTail}`,
        );
        repairedTruncatedTail = true;
      }

      const serializedCompleteLog = `${combinedEvents
        .map((item) => canonicalizeJson(item))
        .join("\n")}\n`;
      await atomicWriteFile(
        layout.worktreeRoot,
        taskLayout.events,
        serializedCompleteLog,
        options,
      );
      return {
        events: combinedEvents,
        serializedCompleteLog,
        contentDigest: sha256Bytes(serializedCompleteLog),
        repairedTruncatedTail,
        replayed: false,
      };
  };

  if (options.taskLockLease !== undefined) {
    const expectedLockPath = layout.taskLock(taskId);
    if (options.taskLockLease.lockPath !== expectedLockPath) {
      throw new ArtifactStoreError(
        "lock_ownership_lost",
        "The supplied Task lock lease does not guard this event log.",
        {
          expectedLockPath,
          actualLockPath: options.taskLockLease.lockPath,
        },
      );
    }
    await options.taskLockLease.refresh();
    return appendWhileLocked();
  }

  return withStoreLock(
    layout.worktreeRoot,
    layout.taskLock(taskId),
    appendWhileLocked,
    options.lock,
  );
}

export function parseTrustedTaskBundle(input: unknown): TaskArtifactBundleV1 {
  return parseTrustedTaskArtifactBundleV1(input, digestCanonicalJson);
}

export function eventLogDescriptorRelativePath(
  layout: ArtifactStoreLayout,
  taskId: string,
): string {
  return repositoryRelativePathFromAbsolute(
    layout.worktreeRoot,
    layout.task(taskId).events,
  );
}
