# @understand-code/task-engine

Persistent, evidence-aware Task Brief generation and lifecycle management for
Agent hosts. The package works without an embedding provider and writes Task
state only through the transactional Artifact Store.

`buildTaskBrief` is a recoverable two-stage orchestration:

1. persist the non-empty intent as `created@1`;
2. build trusted context and persist `context_ready@2`.

Each stage is an independent one-revision mutation. The caller's stable
idempotency key resolves to the same Task ID and replays the original
`context_ready` receipt after completion.

The Host context provider must return `existingFilePaths` verified against the
requested Repository Snapshot. Graph candidates outside that repository-
relative allowlist are excluded from reading and planned-change projections
and persisted as an explicit unknown boundary.
