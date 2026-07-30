import {
  appendFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  RepositorySnapshotArtifactV1Schema,
  TaskEventV1Schema,
  canonicalizeJson,
  canonicalTaskEventDigestJsonV1,
  type PersistedArtifactV1,
  type TaskArtifactBundleV1,
  type TaskEventV1,
} from "@understand-code/contracts";

import {
  ArtifactStore,
  digestCanonicalJson,
  sha256CanonicalJson,
} from "../src/index.js";
import { atomicWriteFile } from "../src/atomic.js";
import {
  appendTaskEvent as appendTaskEventFile,
  parseTaskEventLogText,
  readTaskEventLog,
} from "../src/event-log.js";
import { acquireStoreLock } from "../src/lock.js";
import { ensureManagedDirectory } from "../src/path-guard.js";
import {
  cleanupTemporaryWorktrees,
  createTemporaryWorktree,
  FIXTURE_PRODUCER_VERSION,
  FIXTURE_REPOSITORY_ID,
  FIXTURE_TASK_ID,
  FIXTURE_WORKTREE_ID,
  loadContractFixture,
  loadReferenceEvents,
  loadRepositorySnapshot,
  openFixtureStore,
} from "./helpers.js";

afterEach(cleanupTemporaryWorktrees);

async function openEventStore(root: string) {
  const store = await openFixtureStore(root);
  await store.persistArtifact(await loadRepositorySnapshot());
  await ensureManagedDirectory(
    store.layout.worktreeRoot,
    `.understand-code/tasks/${FIXTURE_TASK_ID}`,
  );
  return store;
}

async function publishReferenceTask(store: ArtifactStore) {
  await store.persistArtifact(await loadRepositorySnapshot());
  await store.persistArtifact(
    await loadContractFixture<PersistedArtifactV1>(
      "reference/repo-pulse.json",
    ),
  );
  const bundle = await loadContractFixture<TaskArtifactBundleV1>(
    "reference/task-bundle.json",
  );
  const artifacts = await Promise.all(
    [
      "task.json",
      "task-brief.json",
      "claims.json",
      "evidence.json",
      "impact.json",
      "change-check.json",
      "verification.json",
    ].map((name) =>
      loadContractFixture<PersistedArtifactV1>(`reference/${name}`),
    ),
  );
  const control = bundle.idempotencyRecords.at(-1);
  expect(control).toBeDefined();
  await store.persistTaskBundle(
    {
      artifacts,
      events: bundle.events,
      idempotencyRecords: bundle.idempotencyRecords,
    },
    {
      expectedRevision: 0,
      historyImport: true,
      idempotencyKey: control!.idempotencyKey,
      requestDigest: control!.requestDigest,
    },
  );
  return bundle;
}

function serializeEvents(events: readonly TaskEventV1[]): string {
  return events.length === 0
    ? ""
    : `${events.map((event) => canonicalizeJson(event)).join("\n")}\n`;
}

describe("Task Event JSONL mechanics", () => {
  it("uses the supplied task-lock policy for internal standalone appends", async () => {
    const root = await createTemporaryWorktree();
    const store = await ArtifactStore.open(root, {
      repositoryId: FIXTURE_REPOSITORY_ID,
      worktreeId: FIXTURE_WORKTREE_ID,
      producerVersion: FIXTURE_PRODUCER_VERSION,
      lock: {
        timeoutMs: 0,
        staleAfterMs: 2_000,
        pollMinMs: 1,
        pollMaxMs: 1,
      },
    });
    await store.initialize();
    await store.persistArtifact(await loadRepositorySnapshot());
    const lease = await acquireStoreLock(
      store.layout.worktreeRoot,
      store.layout.taskLock(FIXTURE_TASK_ID),
    );
    try {
      const [first] = await loadReferenceEvents();
      await expect(
        appendTaskEventFile(store.layout, FIXTURE_TASK_ID, first!, {
          lock: {
            timeoutMs: 0,
            staleAfterMs: 2_000,
            pollMinMs: 1,
            pollMaxMs: 1,
          },
        }),
      ).rejects.toMatchObject({
        code: "lock_timeout",
        details: { timeoutMs: 0 },
      });
    } finally {
      await lease.release();
    }
  });

  it("rewrites the complete verified log and quarantines a non-newline tail", async () => {
    const root = await createTemporaryWorktree();
    const store = await openEventStore(root);
    const [first, second] = await loadReferenceEvents();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    await appendTaskEventFile(store.layout, FIXTURE_TASK_ID, first!);
    const eventsPath = store.layout.task(FIXTURE_TASK_ID).events;
    await appendFile(eventsPath, '{"schemaVersion":1,"partial"');

    const beforeRepair = parseTaskEventLogText(
      await readFile(eventsPath, "utf8"),
    );
    expect(beforeRepair.events).toHaveLength(1);
    expect(beforeRepair.truncatedTail).toContain("partial");

    const appended = await appendTaskEventFile(
      store.layout,
      FIXTURE_TASK_ID,
      second!,
    );
    expect(appended.repairedTruncatedTail).toBe(true);
    expect(appended.events).toHaveLength(2);
    const bytes = await readFile(eventsPath, "utf8");
    expect(bytes.endsWith("\n")).toBe(true);
    expect(bytes).not.toContain("partial");
    expect(parseTaskEventLogText(bytes).events).toHaveLength(2);

    const quarantineDirectory = path.join(
      store.layout.quarantine,
      "events",
    );
    expect((await readdir(quarantineDirectory)).length).toBeGreaterThan(0);
    await expect(
      store.readManifest({ verifyArtifacts: true }),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("repairs a truncated tail even when the retried event already exists", async () => {
    const root = await createTemporaryWorktree();
    const store = await openEventStore(root);
    const [first] = await loadReferenceEvents();
    await appendTaskEventFile(store.layout, FIXTURE_TASK_ID, first!);
    await appendFile(
      store.layout.task(FIXTURE_TASK_ID).events,
      '{"incomplete"',
    );
    const replay = await appendTaskEventFile(
      store.layout,
      FIXTURE_TASK_ID,
      first!,
    );
    expect(replay).toMatchObject({
      replayed: true,
      repairedTruncatedTail: true,
    });
    expect(
      (await readTaskEventLog(store.layout, FIXTURE_TASK_ID)).truncatedTail,
    ).toBe(undefined);
  });

  it("does not change the committed head when an injected pre-rename crash occurs", async () => {
    const root = await createTemporaryWorktree();
    const store = await openEventStore(root);
    const [first, second] = await loadReferenceEvents();
    await appendTaskEventFile(store.layout, FIXTURE_TASK_ID, first!);
    await expect(
      appendTaskEventFile(store.layout, FIXTURE_TASK_ID, second!, {
        faultInjector({ stage }) {
          if (stage === "before_rename") throw new Error("crash");
        },
      }),
    ).rejects.toMatchObject({ code: "artifact_corrupt" });
    expect(
      (await readTaskEventLog(store.layout, FIXTURE_TASK_ID)).events,
    ).toHaveLength(1);
  });

  it("does not infer idempotency scope from Event fields", async () => {
    const root = await createTemporaryWorktree();
    const store = await openEventStore(root);
    const [first, second] = await loadReferenceEvents();
    await appendTaskEventFile(store.layout, FIXTURE_TASK_ID, first!);
    const candidateWithoutDigest = {
      ...second!,
      idempotencyKey: first!.idempotencyKey,
      requestDigest: first!.requestDigest,
      eventDigest: first!.eventDigest,
    };
    const candidate = TaskEventV1Schema.parse({
      ...candidateWithoutDigest,
      eventDigest: digestCanonicalJson(
        canonicalTaskEventDigestJsonV1(candidateWithoutDigest),
      ),
    });
    await expect(
      appendTaskEventFile(store.layout, FIXTURE_TASK_ID, candidate),
    ).resolves.toMatchObject({
      replayed: false,
      events: { length: 2 },
    });
    await expect(
      readTaskEventLog(store.layout, FIXTURE_TASK_ID),
    ).resolves.toMatchObject({ events: [first, candidate] });
  });

  it("reconciles a complete post-rename event on retry without duplicating it", async () => {
    const root = await createTemporaryWorktree();
    const store = await openEventStore(root);
    const [first, second] = await loadReferenceEvents();
    await appendTaskEventFile(store.layout, FIXTURE_TASK_ID, first!);
    await expect(
      appendTaskEventFile(store.layout, FIXTURE_TASK_ID, second!, {
        faultInjector({ stage }) {
          if (stage === "after_rename") throw new Error("crash");
        },
      }),
    ).rejects.toMatchObject({
      code: "artifact_corrupt",
      details: { committed: true },
    });
    const retry = await appendTaskEventFile(
      store.layout,
      FIXTURE_TASK_ID,
      second!,
    );
    expect(retry.replayed).toBe(true);
    expect(retry.events).toHaveLength(2);
    await expect(
      readTaskEventLog(store.layout, FIXTURE_TASK_ID),
    ).resolves.toMatchObject({ events: [first, second] });
  });

  it("rejects malformed complete lines, unknown schemas, broken lifecycle, and broken digests", async () => {
    const root = await createTemporaryWorktree();
    const store = await openEventStore(root);
    const [first, second] = await loadReferenceEvents();
    const eventsPath = store.layout.task(FIXTURE_TASK_ID).events;
    await appendTaskEventFile(store.layout, FIXTURE_TASK_ID, first!);
    const validFirst = await readFile(eventsPath, "utf8");

    for (const invalidLine of [
      "{bad json}\n",
      '{"schemaVersion":999}\n',
      `${JSON.stringify({
        ...second,
        previousStatus: "planned",
      })}\n`,
      `${JSON.stringify({
        ...second,
        eventDigest: first!.eventDigest,
      })}\n`,
    ]) {
      await atomicWriteFile(
        store.layout.worktreeRoot,
        eventsPath,
        `${validFirst}${invalidLine}`,
      );
      await expect(
        readTaskEventLog(store.layout, FIXTURE_TASK_ID),
      ).rejects.toMatchObject({ code: "artifact_corrupt" });
    }
  });

  it("requires task_created as the canonical genesis action", async () => {
    const [first] = await loadReferenceEvents();
    const invalidWithoutDigest = {
      ...first!,
      action: {
        type: "confirm_goal" as const,
        claimId: "claim:forged-genesis",
      },
      eventDigest: first!.eventDigest,
    };
    const invalid = {
      ...invalidWithoutDigest,
      eventDigest: digestCanonicalJson(
        canonicalTaskEventDigestJsonV1(invalidWithoutDigest),
      ),
    };
    expect(() =>
      parseTaskEventLogText(`${canonicalizeJson(invalid)}\n`),
    ).toThrowError(expect.objectContaining({ code: "artifact_corrupt" }));
  });

  it.each([
    {
      label: "leading whitespace",
      serialize: (_event: TaskEventV1, canonical: string) =>
        ` ${canonical}`,
    },
    {
      label: "non-canonical key order",
      serialize: (event: TaskEventV1) =>
        JSON.stringify(
          Object.fromEntries(Object.entries(event).reverse()),
        ),
    },
    {
      label: "Unicode escape",
      serialize: (_event: TaskEventV1, canonical: string) =>
        canonical.replace(
          '"actor":"codex"',
          '"actor":"\\u0063odex"',
        ),
    },
  ])(
    "rejects semantically equivalent JSONL encoded with $label",
    async ({ serialize }) => {
      const [first] = await loadReferenceEvents();
      expect(first).toBeDefined();
      const canonical = canonicalizeJson(first!);
      const noncanonical = serialize(first!, canonical);
      expect(noncanonical).not.toBe(canonical);
      expect(JSON.parse(noncanonical)).toEqual(JSON.parse(canonical));
      expect(() =>
        parseTaskEventLogText(`${noncanonical}\n`),
      ).toThrowError(
        expect.objectContaining({ code: "artifact_corrupt" }),
      );
    },
  );

  it("rejects a backdated event without changing the committed head", async () => {
    const root = await createTemporaryWorktree();
    const store = await openEventStore(root);
    const [first, second] = await loadReferenceEvents();
    await appendTaskEventFile(store.layout, FIXTURE_TASK_ID, first!);
    const backdatedWithoutDigest = {
      ...second!,
      occurredAt: "2026-07-28T07:59:00Z",
    };
    const backdated = TaskEventV1Schema.parse({
      ...backdatedWithoutDigest,
      eventDigest: digestCanonicalJson(
        canonicalTaskEventDigestJsonV1(backdatedWithoutDigest),
      ),
    });

    await expect(
      appendTaskEventFile(store.layout, FIXTURE_TASK_ID, backdated),
    ).rejects.toMatchObject({ code: "artifact_corrupt" });
    await expect(
      readTaskEventLog(store.layout, FIXTURE_TASK_ID),
    ).resolves.toMatchObject({ events: [first] });
  });

  it("rejects a duplicate eventId while parsing an existing log", async () => {
    const [first, second] = await loadReferenceEvents();
    const duplicateWithoutDigest = {
      ...second!,
      eventId: first!.eventId,
    };
    const duplicate = TaskEventV1Schema.parse({
      ...duplicateWithoutDigest,
      eventDigest: digestCanonicalJson(
        canonicalTaskEventDigestJsonV1(duplicateWithoutDigest),
      ),
    });
    expect(() =>
      parseTaskEventLogText(
        `${canonicalizeJson(first)}\n${canonicalizeJson(duplicate)}\n`,
      ),
    ).toThrowError(expect.objectContaining({ code: "artifact_corrupt" }));
  });
});

describe("ArtifactStore Event recovery boundary", () => {
  it("leaves zero Event bytes when repository-lock contention blocks recovery", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const bundle = await publishReferenceTask(store);
    const event = bundle.events.at(-1);
    expect(event).toBeDefined();
    const eventsPath = store.layout.task(FIXTURE_TASK_ID).events;
    await rm(eventsPath);
    const contender = await ArtifactStore.open(root, {
      repositoryId: FIXTURE_REPOSITORY_ID,
      worktreeId: FIXTURE_WORKTREE_ID,
      producerVersion: FIXTURE_PRODUCER_VERSION,
      lock: {
        timeoutMs: 0,
        staleAfterMs: 2_000,
        pollMinMs: 1,
        pollMaxMs: 1,
      },
    });
    const lease = await acquireStoreLock(
      store.layout.worktreeRoot,
      store.layout.repositoryLock,
    );

    try {
      await expect(
        contender.appendTaskEvent(FIXTURE_TASK_ID, event!),
      ).rejects.toMatchObject({
        code: "lock_timeout",
        details: { timeoutMs: 0 },
      });
    } finally {
      await lease.release();
    }
    await expect(readFile(eventsPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("fails closed when the Manifest is ahead of a gapped Event log", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const bundle = await publishReferenceTask(store);
    const eventsPath = store.layout.task(FIXTURE_TASK_ID).events;
    const gappedBytes = serializeEvents(bundle.events.slice(0, 10));
    await atomicWriteFile(
      store.layout.worktreeRoot,
      eventsPath,
      gappedBytes,
    );

    await expect(
      store.readTaskEvents(FIXTURE_TASK_ID),
    ).rejects.toMatchObject({ code: "manifest_inconsistent" });
    await expect(
      store.appendTaskEvent(FIXTURE_TASK_ID, bundle.events.at(-1)!),
    ).rejects.toMatchObject({ code: "reference_integrity_failed" });
    await expect(readFile(eventsPath, "utf8")).resolves.toBe(
      gappedBytes,
    );
  });

  it("rejects a cache-shaped standalone recovery with a forged actor and action", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const bundle = await publishReferenceTask(store);
    const eventsPath = store.layout.task(FIXTURE_TASK_ID).events;
    const gappedBytes = serializeEvents(bundle.events.slice(0, -1));
    await atomicWriteFile(
      store.layout.worktreeRoot,
      eventsPath,
      gappedBytes,
    );
    const committed = bundle.events.at(-1)!;
    const forgedWithoutDigest = {
      ...committed,
      eventId: "event:forged-standalone-recovery",
      actor: "attacker",
      resultingStatus: "superseded" as const,
      action: {
        type: "supersede_task" as const,
        reason: "Forge Event facts from a non-authoritative cache.",
      },
      eventDigest: committed.eventDigest,
    };
    const forged = TaskEventV1Schema.parse({
      ...forgedWithoutDigest,
      eventDigest: digestCanonicalJson(
        canonicalTaskEventDigestJsonV1(forgedWithoutDigest),
      ),
    });

    await expect(
      store.appendTaskEvent(FIXTURE_TASK_ID, forged),
    ).rejects.toMatchObject({
      code: "reference_integrity_failed",
      details: {
        eventId: forged.eventId,
        committedRevision: committed.revision,
      },
    });
    await expect(readFile(eventsPath, "utf8")).resolves.toBe(
      gappedBytes,
    );
  });

  it("replays exact durable Event bytes after the current Snapshot advances", async () => {
    const root = await createTemporaryWorktree();
    const store = await openFixtureStore(root);
    const bundle = await publishReferenceTask(store);
    const event = bundle.events.at(-1);
    expect(event).toBeDefined();
    const eventsPath = store.layout.task(FIXTURE_TASK_ID).events;
    const durableBytes = await readFile(eventsPath, "utf8");
    const snapshot = await loadRepositorySnapshot();
    if (snapshot.artifactType !== "repository_snapshot") {
      throw new TypeError("Reference Snapshot fixture has the wrong type.");
    }
    const advancedPayload = {
      ...snapshot.payload,
      snapshotId: "snapshot:advanced",
      headCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      createdAt: "2026-07-28T09:00:00Z",
    };
    const advancedSnapshot = RepositorySnapshotArtifactV1Schema.parse({
      ...snapshot,
      artifactId: "artifact:repository-snapshot:advanced",
      sourceSnapshotId: advancedPayload.snapshotId,
      createdAt: advancedPayload.createdAt,
      contentDigest: sha256CanonicalJson(advancedPayload),
      payload: advancedPayload,
    });
    await store.persistArtifact(advancedSnapshot);

    const replay = await store.appendTaskEvent(
      FIXTURE_TASK_ID,
      event!,
    );
    expect(replay).toMatchObject({
      replayed: true,
      repairedTruncatedTail: false,
      events: bundle.events,
    });
    await expect(readFile(eventsPath, "utf8")).resolves.toBe(
      durableBytes,
    );
    await expect(
      store.readTaskEvents(FIXTURE_TASK_ID),
    ).resolves.toMatchObject({ events: bundle.events });
  });
});
