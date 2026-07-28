# WP1 Contract Matrix and Version Policy

> Status: WP1 contract gate closed
>
> Product release train: `3.0.0-alpha.1`
>
> Contract generation: V1

## 1. Ownership boundary

`@understand-code/contracts` is the only owner of persisted V1 artifact shapes and
cross-process MCP DTOs.

Production contract modules may depend on Zod. They do not read the filesystem,
invoke Git, calculate hashes, start a server, or import React. Consumers may
validate and interpret values, but they must not maintain shadow copies of these
wire types.

| Consumer | Allowed responsibility | Forbidden responsibility |
|---|---|---|
| Core / Repository State | Produce and validate payloads; calculate digests | Redefine persisted DTOs |
| Artifact Store | Atomic persistence, locking, CAS, migration execution | Weaken schema or reference integrity |
| Task Engine | Apply lifecycle guards and build deterministic results | Add unversioned states or actions |
| MCP Server | Bind roots, paginate, enforce budgets, call handlers | Duplicate business analysis |
| Dashboard | Parse contracts and render projections | Write artifact JSON directly |
| Host adapters | Start the shared server and guide tool order | Parse Graph files or execute repository analysis |

## 2. Persisted V1 artifacts

Every new JSON artifact below uses `ArtifactEnvelopeV1`. The content digest is
calculated over the canonical JSON representation of `payload` only.

| Artifact type | Payload contract | Scope |
|---|---|---|
| `repository_snapshot` | `RepositorySnapshotV1` | Repository / worktree |
| `repo_pulse` | `RepoPulseV1` | Repository / worktree |
| `task_manifest` | `TaskManifestV1` | Task |
| `task_brief` | `TaskBriefV1` | Task |
| `claim_ledger` | `{ claims: ClaimV1[] }` | Task |
| `evidence_ledger` | `{ evidence: EvidenceV1[] }` | Task |
| `impact` | `{ paths: ImpactPathV1[] }` | Task |
| `change_check` | `ChangeCheckV1` | Task |
| `verification` | `{ records: VerificationRecordV1[] }` | Task |

`artifact-manifest.json` is a strict control index, not a tenth artifact
envelope type. `events.jsonl` is a deliberate persistence exception: each line
validates as `TaskEventV1`, while the file itself is represented by a
`task_event_log` descriptor.

The public `PersistedArtifactV1Schema` dispatcher binds every envelope
`artifactType` to its exact payload schema, so a structurally valid base
envelope cannot disguise one payload as another. Consumers that read bytes also
run `verifyArtifactContentDigestV1` with a host-provided SHA-256 implementation;
structural parsing and digest verification remain separate, explicit checks.

## 3. Legacy artifact policy

Existing Graph, Meta, Fingerprint, Wiki, and Diff artifacts remain explicit
`legacy_raw` formats. They are not silently wrapped in V1 envelopes.

| Legacy family | Compatibility |
|---|---|
| Graph V1 / Meta V1 / Fingerprint V1 | Explicit legacy reader; current writer may remain during migration |
| Wiki V1 / Wiki V2 support files | Read-only compatibility input |
| Diff Overlay V1 | Historical read-only input; never an active Change Check source |
| Unknown legacy version | Fail closed with an unsupported-version decision |
| Registered migration | Migrate into isolated temporary output, validate, then let the Store atomically switch |

The pure Contracts migration registry only plans and transforms JSON values.
Backup, fsync, atomic rename, directory fsync, rollback, and audit events belong
to the Artifact Store.

All nine registered legacy descriptor tuples have exact tracked fixtures:
Graph V1, Meta V1, Fingerprint V1, Wiki Index V1/V2, Wiki Search V2,
Wiki Document Traces V2, Wiki Generation Report V2, and Diff Overlay V1.
Descriptor type, format, path, schema version, and read policy are one
registered identity; cross-wired tuples fail closed.

## 4. Canonical digest contract

1. Validate or construct a JSON-compatible payload.
2. Reject `undefined`, non-finite numbers, sparse arrays, accessors, symbols,
   cycles, and non-plain objects.
3. Sort object keys recursively; preserve array order.
4. Encode the canonical JSON string as UTF-8.
5. Calculate SHA-256 and format it as `sha256:<64 lowercase hex>`.

Envelope identity, timestamps, revision, and the `contentDigest` field itself do
not participate in the content digest. Hash calculation remains outside the
portable Contracts runtime.

## 5. Task and evidence invariants

- Persisted Task IDs are canonical uppercase ULIDs.
- A created Task starts at revision 1; callers create it with
  `expectedRevision: 0`.
- Normal lifecycle transitions follow the G0 D-21 table. Block, resume,
  refresh, rebase, supersede, Finding acceptance, and verification-skip
  acceptance use dedicated actions.
- A successful mutation increments revision exactly once and appends exactly
  one digest-chained event. History starts with one canonical revision-1
  `task_created` genesis Event; truncated history is invalid. Events carry
  previous/resulting status and must replay to the persisted final Task status.
- Trusted Task readers call `parseTrustedTaskArtifactBundleV1` with a
  host-provided SHA-256 implementation. It recomputes every canonical Event
  digest and validates the previous-digest chain; structural Zod parsing alone
  is not treated as cryptographic integrity.
- A recovery bundle may contain only a contextless `created` Task; all later
  states require the complete Claim/Evidence/Impact/Check/Verification graph.
- Idempotency identity is
  `(worktreeId, task/create scope, idempotencyKey)` plus canonical request
  digest and Actor.
- Claim ↔ Evidence, Claim ↔ Finding, and Claim ↔ Verification references are
  symmetric and non-dangling.
- Observed and inferred Claims need Evidence. Unknown Claims carry an explicit
  boundary reason. Inferred facts carry a derivation path. Human confirmation
  does not rewrite inferred facts as observed facts.
- Observed Impact edges require direct evidence; inferred Impact edges require
  evidence plus derivation. Findings always reference at least one
  `kind=finding` Claim.
- A verified Task has a canonical current-snapshot/current-revision Change
  Check, no unresolved blocking Finding, and a passed or explicitly
  accepted-skip latest attempt for every required verification-plan entry.
  Failed historical attempts remain auditable but do not poison a later pass.
- `record_verification` input cannot self-assert an accepted skip or attempt
  number. The Task Engine assigns attempts, binds records to plan entries, and
  validates explicit retry supersession.

## 6. Manifest and freshness invariants

The Manifest binds one canonical worktree. Descriptors carry stable artifact
identity, storage format, schema version, generated time, source snapshot,
digest, freshness, and explicit dependencies.

- Duplicate artifact IDs and paths are invalid.
- Self, dangling, and cyclic dependencies are invalid.
- Required dependency digest and snapshot mismatches are invalid.
- A fresh artifact cannot depend on a partial, stale, or invalid artifact.
- A fresh current artifact must use the Manifest latest snapshot.
- A `ready` Manifest must point at one current, usable, V1-enveloped Repository
  Snapshot rather than a corrupt or legacy descriptor.
- Historical and recovery descriptors remain distinguishable from current
  product data.

WP2 computes new freshness states; WP1 prevents an internally contradictory
Manifest from being accepted.

A `fresh` Repo Pulse is deliberately hard to claim: it requires structured
repository state and change counts, complete parser/call-graph coverage, no
errors or unknowns, no refresh recommendation, and explicit fresh entries for
Graph, Wiki, Evidence, Diff, and Task. Omitting a family cannot produce fresh.

## 7. MCP V1 surface

The P0 surface contains exactly eleven tools:

1. `get_repo_pulse`
2. `build_task_brief`
3. `get_task_brief`
4. `update_task`
5. `search_context`
6. `get_evidence`
7. `trace_impact`
8. `check_change`
9. `record_verification`
10. `open_workbench`
11. `refresh_index`

Every success includes repository, worktree, snapshot, commit, fingerprint,
freshness, duration, cache, and truncation metadata. Paged results use one
cursor contract. Tool failures use one machine-readable Error Envelope; no
universal `retryable` flag is exposed.

Workspace binding has exactly six ordered reasons:

`root_conflict`, `root_missing`, `root_not_directory`, `root_unavailable`,
`root_not_allowed`, and `secondary_session_required`.

Task mutation failures preserve three additional non-overlapping codes:
`task_transition_rejected`, `task_gate_unsatisfied`, and
`action_not_authorized`. Schema incompatibility, CAS/idempotency conflicts,
state transitions, unsatisfied guards, and authorization failures remain
machine-distinguishable. Public text rejects POSIX, quoted POSIX, Windows,
UNC, and `file:` URI path leakage. The same recursive check applies to every
string nested in `structuredContent.error.details`, including punctuation-
wrapped paths.

`open_workbench` exposes Runtime identity as a strict
`{ productVersion, worktreeId }` pair and binds its worktree to success
metadata. Every one of the eleven tool outputs has a positive contract fixture
and an identity, pagination, or semantic-refinement negative case.

Refresh cancellation uses the MCP request-cancellation protocol and cooperative
last-snapshot preservation. It is not a twelfth product tool.

## 8. JSON Schema boundary

Generated JSON Schemas cover transport structure, strict fields, scalar
formats, discriminated unions, and collection bounds. Zod semantic refinements
remain authoritative for cross-record rules such as reference symmetry,
dependency DAG validation, lifecycle consistency, and digest verification.

A consumer must therefore:

1. use JSON Schema for protocol/transport validation where needed; and
2. run the matching Contracts parser before treating persisted data as trusted.

## 9. Compatibility and versioning

- `schemaVersion` changes only when the persisted or wire contract changes.
- npm patch versions do not imply schema changes.
- During the monorepo Alpha, the package remains workspace-internal as
  `private@0.1.0`; WP8 owns the publishable package/version decision.
- Beta supports current and explicitly registered legacy formats.
- Stable supports the current and previous artifact schema generations.
- Removing a schema requires a prior minor-release deprecation warning.
- Unknown fields are rejected for all new V1 contracts.
- Unsupported newer data enters read-only recovery or fails closed; it is never
  rewritten in place.

## 10. Local implementation evidence

Evidence captured on 2026-07-28 with the frozen workspace lockfile:

| Boundary | Result |
|---|---|
| Contracts | 12 test files, 119 tests passed |
| Generated assets | 49 JSON Schemas and 28 fixtures verified byte-for-byte |
| Independent JSON Schema validator | All 49 public schemas compile; generated positive shapes pass and unknown fields fail |
| Packed distribution | Root plus 13 explicit subpaths, static schemas/fixtures, declarations, and a Vite browser bundle pass from a cold tarball install |
| Runtime boundary | No filesystem/Git/server/React or Node-only global leakage in production modules |
| Root skill | 10 files, 94 tests passed |
| Core | 52 files, 923 tests passed, including trusted Task Event digests, shared artifacts, digest mismatch, Graph V1, and Wiki readers |
| Dashboard | 50 files, 560 tests passed, including trusted Task Event digests, shared reference, digest mismatch, and negative artifacts |
| Root quality | Clean build, typecheck, and every maintained suite passed |
| Independent adversarial audit | Three rounds completed; final result `0 P0 / 0 P1` |
| Remote CI | GitHub Actions [run 30355180068](https://github.com/chifanjie/Tomato/actions/runs/30355180068) passed the quality and active-surface gates |

Core, the MCP DTO suite, and Dashboard parse the exact tracked Snapshot, Task,
and Task Bundle; all three use the trusted Event-digest parser and reject body
tampering. The MCP DTO suite also parses the exact tracked Repo Pulse and binds
its envelope snapshot identity to success metadata. This is the WP1 contract
consumer evidence; the executable MCP Server remains a WP6 delivery.

## 11. WP1 closeout checklist

- [x] Contracts build and typecheck pass from a clean workspace.
- [x] Positive and negative Zod fixtures pass.
- [x] Tracked JSON Schemas match generated schemas.
- [x] JSON Schema fixtures pass an independent validator.
- [x] Core, MCP DTOs, and Dashboard consume exact tracked reference artifacts.
- [x] All nine registered legacy descriptors receive explicit compatibility
      decisions and fixtures; real Core Wiki readers accept the Wiki fixtures.
- [x] Corrupt JSON, unknown version, digest mismatch, dangling reference,
      invalid lifecycle, stale Check, blocking Finding, and retry fixtures fail
      or recover with their frozen semantics.
- [x] Root `quality` passes on the frozen toolchain.
- [x] Remote CI passes the pushed WP1 commit.

This closes the WP1-local contract/schema gate. It does not close the full M1
G1 product gate: WP2 must still prove that arbitrary worktree changes cannot be
misreported as fresh and that old knowledge artifacts become stale.
