# WP3 Artifact Store, Evidence, and Recovery Matrix

> Status: WP3 implementation, exact staged-tree verification, independent
> audit, feature push, and remote CI are complete.

## 1. Purpose

WP3 turns the portable V1 Contracts into a durable, worktree-scoped trust
boundary. It owns `.understand-code/**` persistence for Repository Snapshot,
Repo Pulse, Task state, Event history, Evidence/Claim traces, publication
metadata, idempotency, backup, recovery, and controlled migration.

Implementation package:

- `packages/artifact-store`
- primary public entry point: `ArtifactStore`
- read-only/public helpers: digest utilities, Artifact Store errors, layout
  types, Event parsers, and the Evidence adapter
- raw atomic writes and lock primitives are internal and are not exported from
  the package root

## 2. Mutation boundary

| Mutation | Required API | Commit point | Result |
|---|---|---|---|
| Immutable Repository Snapshot create/replay | `persistArtifact` | Manifest descriptor switch | Pass |
| Repo Pulse | `persistArtifact` | Manifest descriptor switch | Pass |
| Contextual Task revision | `persistTaskBundle` | one complete Task descriptor-set switch | Pass |
| Contextless cold recovery Task | `persistTaskBundle` | partial Task/Event descriptor-set switch | Pass |
| Standalone Task Artifact | forbidden | none | Pass |
| Ordinary standalone Event | forbidden | none | Pass |
| Recovery-only Event repair | `appendTaskEvent` | matching Event descriptor switch | Pass |
| Published mutable repository Artifact migration | `migrateJson` | migrated Manifest descriptor switch | Pass |
| Published Repository Snapshot migration | forbidden | none | Pass |
| Task/Event single-file migration | forbidden | none | Pass |

Task publication validates all seven contextual Artifacts, cross-ledger
references, the Event digest chain, CAS revision, and idempotency control before
the Manifest makes any bytes public.

## 3. Atomicity and durability

Every managed file replacement uses:

1. an exclusive same-directory temporary file;
2. complete write;
3. file `fsync`;
4. parent/path stability recheck;
5. atomic rename;
6. parent-directory `fsync`.

Every newly created managed directory also `fsync`s its parent after path,
directory-type, and symlink checks. This includes creation of the initial
`.understand-code` entry in the canonical worktree root.

Artifact/Event bytes written before a Manifest failure are restored to their
previous bytes or quarantined when no prior file existed. A Manifest write that
has crossed atomic rename is reported as committed/ambiguous and is never
silently treated as an uncommitted rollback.

## 4. Locks, CAS, and idempotency

- Repository-only mutation uses the repository lock.
- Task mutation acquires Task then repository lock.
- A nonce identifies every lease.
- A live same-host PID is never stolen solely because its heartbeat is old.
- Ownerless initialization is fail-closed.
- Stale recovery requires a complete same-host owner record and a proven-dead
  PID.
- An external exclusive stale-recovery claim serializes competing breakers and
  closes the delayed-breaker ABA window.
- Mutable Artifact revision replacement advances exactly once from
  `expectedRevision`.
- Repository Snapshots are immutable revision-`0` facts. Identical bytes may
  replay, while changed state requires a new content-addressed Snapshot
  identity.
- Durable idempotency records bind key, request digest, Artifact identity,
  result revision, and result digest.
- Orphan bytes are publishable only by an identical, revision-valid,
  idempotent reconciliation.

## 5. Snapshot and dependency trust

No current Manifest descriptor is trusted from metadata alone.

- Repository Snapshot bytes are parsed and digest-verified.
- A Snapshot identity is immutable; historical descriptors remain addressable
  instead of being revised in place.
- Repository-scoped downstream writes require the current verified Snapshot.
- Contextual Task publication additionally requires a verified current Repo
  Pulse.
- Direct reads verify the matching source Snapshot bytes, including historical
  Snapshot bytes for stale/historical Artifacts.
- Direct Task reads verify every same-revision Task descriptor, canonical
  Artifact byte, Event-log byte/digest, and recursive required dependency
  before returning any member of the Task.
- The only missing-Snapshot read exception is an explicit contextless cold
  recovery Task whose descriptors are `partial`.
- Read results expose descriptor state, freshness, and the latest Snapshot
  identity. Historical/read-only states are explicit, and invalid freshness
  fails closed.
- Canonical dependency pins include both `requiredDigest` and
  `requiredSnapshotId`.
- Caller-supplied dependencies may add edges but cannot weaken or replace a
  canonical pin.

Canonical contextual Task DAG:

| Artifact | Required dependencies |
|---|---|
| Task Manifest | Repository Snapshot, Repo Pulse |
| Claim Ledger | Task Manifest |
| Evidence Ledger | Task Manifest, Claim Ledger |
| Impact | Claim Ledger, Evidence Ledger |
| Task Brief | Task Manifest, Claim Ledger, Evidence Ledger, Impact |
| Change Check | Task Brief, Evidence Ledger, Impact |
| Verification | Change Check, Claim Ledger |
| Event Log | Task Manifest |

## 6. Event log policy

- Complete JSONL lines must be exact canonical JSON bytes.
- Leading whitespace, key reordering, Unicode escape alternatives, blank
  complete lines, unknown schemas, lifecycle gaps, duplicate identity, and
  digest-chain breaks are rejected.
- A non-newline tail is never interpreted as committed.
- Repair rewrites the complete verified log atomically and quarantines the
  partial tail.
- Repository-lock contention produces zero new Event bytes.
- Manifest-ahead/log-behind state fails closed.
- Exact durable retries remain replayable after the repository advances to a
  newer Snapshot.

## 7. Backup, recovery, and migration

- Backups use a per-target durable monotonic sequence; wall-clock rollback and
  same-millisecond writes do not alter newest-first selection.
- Missing or corrupt Manifests recover only from a backup whose descriptors
  still match canonical files.
- Artifact recovery requires an existing committed descriptor.
- Candidate backups are typed, digest-checked, identity-checked, and rejected
  when they conflict with dependency pins.
- Recovered descriptors become `read_only_recovery` and stale.
- Task-scoped single-file recovery is forbidden because it could mix
  revisions; whole-Task recovery requires a future bundle transaction.
- A recovery Manifest error after atomic rename preserves the published bytes
  and reports committed ambiguity for idempotent reconciliation.
- Unrecoverable corruption marks the target corrupt/invalid and propagates
  invalid freshness through dependents.
- Infrastructure, path, and lock failures are rethrown; they are not
  misclassified as bad backup candidates.
- Migration validation may be asynchronous and is awaited in isolation.
- Unpublished migration targets are restricted to
  `.understand-code/legacy/*.json`.
- Published mutable-Artifact migration backs up Artifact and Manifest,
  preserves identity, advances V1 revision once, updates the descriptor, and
  rejects digest-pinned dependents unless a complete future transaction owns
  them.
- Published Repository Snapshots are never migrated in place.

## 8. Evidence and Claim boundary

- Wiki V2 page/trace/node/evidence/claim invariants are jointly validated.
- Source line anchors require actual source bytes.
- Optional source digests are checked against those bytes.
- Claim statements and Evidence excerpts are sanitized.
- Cookie, common credential, AWS-key, and high-entropy token patterns are
  redacted.
- PRD §15.3 sensitive paths are hard-denied.
- Source changes invalidate Evidence and propagate fail-closed freshness to
  Claims.

## 9. Local verification

Current package verification:

- source and test TypeScript checks: passed;
- Artifact Store package build: passed;
- Vitest: 7 files, 83 tests passed;
- Event recovery boundary: 16 tests passed;
- Evidence adapter: 10 tests passed;
- lock/CAS suite: 10 tests passed;
- migration/recovery/Task bundle suite: 36 tests passed;
- path/atomic/directory durability: 9 tests passed;
- canonical JSONL stability loop: three consecutive Event-suite passes;
- concurrent CAS stress: 30 consecutive passes after the guarded-path race
  fix;
- independent final P0/P1 re-audit: passed;
- staged-tree `git diff --check`: passed;
- exact staged-tree `pnpm install --frozen-lockfile`: passed;
- exact staged-tree root `pnpm quality`: passed (1,846 tests passed and one
  platform-conditional Repository State test skipped);
- feature commit:
  `11ef2374ce7ec2f828f94008fb926add46c6b12d`;
- remote GitHub Actions CI run
  `30426962180`: passed (`Quality gate`, 4m28s).

## 10. Residual threat boundary

The V1 implementation protects static path escape, symlinks, malformed
identity, and races among cooperating Artifact Store processes. Node's
path-based filesystem API does not expose a complete descriptor-relative
`openat` transaction. An actively malicious process running as the same OS
user can therefore race the final validation-to-syscall boundary. Untrusted
workloads require separate OS users or container isolation.

Ownerless locks and stale-breaker claims intentionally fail closed after a
process crash. They require explicit operator cleanup rather than guessing
ownership and risking a newer generation.

## 11. Closure checklist

- [x] Atomic file and directory durability implemented.
- [x] Repository/Task lock order and stale-breaker ABA regression covered.
- [x] Repository Artifact CAS and idempotency covered.
- [x] Task bundle and Event recovery transaction boundaries covered.
- [x] Source Snapshot byte gates and canonical dependency pins covered.
- [x] Backup ordering, quarantine, missing Manifest, and recovery covered.
- [x] Published migration and joint rollback covered.
- [x] Evidence/Claim validation, redaction, and invalidation covered.
- [x] Raw mutation primitives removed from the package root API.
- [x] Independent final re-audit passes.
- [x] Exact staged tree installs with `pnpm install --frozen-lockfile`.
- [x] Exact staged tree passes root `pnpm quality`.
- [x] WP3 feature commit is pushed independently.
- [x] Remote GitHub Actions quality gate passes that commit.

## 12. Closure evidence

- Branch: `feature/agent-native-change-intelligence`
- Exact final staged tree:
  `f6df4c967f1ae558ddc00dc3556ce82447f56ac2`
- Feature commit:
  `11ef2374ce7ec2f828f94008fb926add46c6b12d`
- CI workflow/run: `CI` / `30426962180`
- CI result: `success`

WP3 is closed. WP4 may build its persistent Task lifecycle only through the
high-level Store transaction boundary. Whole-Task recovery and full
idempotency-record reconstruction remain explicit WP4 contract work; no WP4
caller may compose Task state from single-file recovery.
