# @understand-code/artifact-store

Node.js persistence for Agent-native repository and task artifacts.

The package owns the canonical, worktree-scoped `.understand-code` layout and
adds the durability and trust boundary that the portable Contracts package
intentionally does not implement:

- component-by-component path containment with sensitive-path and symlink
  denial;
- same-directory exclusive temporary files, file `fsync`, atomic rename, and
  directory `fsync`, including every newly created parent entry;
- nonce-owned cross-process repository/task locks with bounded waits and safe
  same-host stale-owner recovery serialized by an exclusive breaker claim;
- revision compare-and-swap for mutable Artifacts and durable idempotency
  replay records;
- typed Artifact parsing plus host SHA-256 verification on every V1 read;
- atomic Task Event JSONL replacement with schema, lifecycle, and digest-chain
  verification;
- monotonic backup sequencing, corrupt quarantine, read-only recovery, and
  transactional Artifact/Manifest migrations;
- Wiki V2 Evidence/Claim Trace adaptation and source-digest invalidation.

## Basic use

```ts
import { ArtifactStore } from "@understand-code/artifact-store";

const store = await ArtifactStore.open("/absolute/canonical-worktree", {
  repositoryId: "repository:example",
  worktreeId: "worktree:example",
  producerVersion: "3.0.0-alpha.1",
});

await store.initialize();
await store.persistArtifact(repositorySnapshot);
await store.persistArtifact(repoPulse, {
  expectedRevision: 0,
  idempotencyKey: "create:repo-pulse",
  requestDigest: "sha256:...",
});

await store.persistTaskBundle(
  {
    artifacts: taskArtifacts,
    events: taskEvents,
    idempotencyRecords,
  },
  {
    expectedRevision: 0,
    idempotencyKey: "create:task",
    requestDigest: "sha256:...",
  },
);
```

`persistArtifact` is intentionally limited to repository-scoped Snapshot and
Repo Pulse envelopes. Task-scoped state must use `persistTaskBundle`, which
validates and commits the seven contextual Task Artifacts, canonical dependency
pins, Event log, CAS revision, and idempotency control as one publication.
The public `appendTaskEvent` method is recovery-only: normal Task mutations do
not use a standalone Event write.

Repository Snapshots are immutable facts: their revision is always `0`, an
identical canonical Snapshot may be replayed, and changed repository state must
use a new content-addressed Snapshot identity. A published Snapshot is never
revised or migrated in place.

A successful read passes the typed parser, payload digest verification,
matching Manifest descriptor, source Snapshot byte verification, and actual
dependency-byte verification. Task-scoped reads validate the complete
same-revision descriptor set plus the Event log. Read results expose the
descriptor, `state`, `freshness`, and `latestSnapshotId`; `historical` and
`read_only_recovery` are explicit, while `invalid` is rejected.

The one Snapshot-less exception is the Contracts-defined contextless Task
recovery transaction. It may publish only `task_manifest` plus its Event
history and idempotency records while the repository is cold. Both resulting
descriptors remain `partial` until repository context is available.

Recovery never treats schema validity alone as proof of publication. Manifest
backups must still match every referenced canonical file, and Artifact backups
must be publishable without rewriting dependency digest pins. If no candidate
satisfies those constraints, the original descriptor is marked corrupt and
transitive dependents are marked invalid.

Task-scoped Artifacts are never recovered one file at a time because doing so
could mix revisions inside one semantic Task transaction. Until a whole-bundle
recovery contract exists, a damaged Task fails closed.

If an atomic Manifest write reports an error after rename, the publication is
kept and the committed/ambiguous error is returned to the caller. An identical
idempotent retry verifies and reconciles the published result.

## Lock ordering

Task mutations acquire the task lock before the repository lock needed to
publish a Manifest descriptor. Repository-only writes acquire only the
repository lock. Callers should use the high-level `ArtifactStore` methods
instead of composing lower-level locks in a different order.

Ownerless locks are never guessed stale. A fully identified same-host owner is
recoverable only after its PID is proven dead. Competing stale breakers are
serialized by an exclusive recovery claim, so a delayed breaker cannot remove
a newer lock generation. A breaker crash leaves that claim fail-closed for
operator cleanup.

## Event log crash policy

The package never appends bytes in place. Under the task lock it parses every
complete line, verifies the digest chain and lifecycle continuity, quarantines
an incomplete tail, and replaces the full log through the atomic-write
protocol. A non-newline-terminated final fragment is never interpreted as a
committed event.

## Migration policy

`migrateJson` awaits asynchronous validation in an isolated directory before
switching bytes. An unpublished input is accepted only below
`.understand-code/legacy/`. A published mutable repository Artifact is migrated
under the repository lock with both Artifact and Manifest backups; the
Manifest descriptor switch is the commit point. Identity must remain
canonical, V1 revision advances exactly once, and digest-pinned dependents
cause a fail-closed rejection. Immutable Repository Snapshots, Task files, and
Event logs cannot be migrated individually.

## Security boundary

Managed paths reject traversal, sensitive components, and symlinks, and each
filesystem transition revalidates its parent. These controls protect against
static path escape and cooperating-process races. Node's path-based filesystem
API cannot provide a fully descriptor-relative `openat` transaction, so an
actively malicious process with the same OS-user permissions can still race
the final validation-to-syscall boundary. Such a process is outside the V1
threat model; untrusted workloads require OS-level user or container isolation.
