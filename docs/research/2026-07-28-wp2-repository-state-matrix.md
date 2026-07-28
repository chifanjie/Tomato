# WP2 Repository State and Repo Pulse Matrix

> Status: local implementation and exact-tree root gates passed; independent
> feature push and remote CI remain required before WP2 closure.

## 1. Purpose

WP2 establishes the deterministic repository-state boundary used by Task
Intelligence. It must distinguish a repository that was proven clean from one
that could not be inspected, include committed and uncommitted work, and make
Artifact freshness explainable without silently trusting old Graph, Wiki, Diff,
Evidence, or Task data.

Implementation package:

- `packages/repository-state`
- public entry points: `getRepositorySnapshot()`,
  `getRepositorySnapshotDetailed()`, `inspectArtifactFreshness()`,
  `classifyRepositoryChanges()`, `decideGraphRefresh()`,
  `assessChangeRisk()`, and `buildRepoPulse()`

## 2. Contract boundary

The package emits the exact `RepositorySnapshotV1` and `RepoPulseV1` payloads
owned by `@understand-code/contracts`.

The boundary is intentionally split:

- Snapshot records immutable Git/Index/Worktree/Untracked facts.
- Freshness compares persisted Artifacts with the current Snapshot.
- Graph refresh cost and change-review risk are separate decisions.
- Repo Pulse combines repository, Artifact, and completeness state.
- Artifact migration and mutation belong to Artifact Store, not WP2.
- Task/Evidence recomputation is reported separately from `refresh_index`;
  the V1 `recommendedRefresh` field remains an index-refresh decision.

## 3. Repository Snapshot coverage

| Requirement | Implementation evidence | Result |
|---|---|---|
| Clean repository | Contract-valid complete Snapshot with no changes | Pass |
| `baseline..HEAD` | Commit range, merge-base, ahead/behind | Pass |
| Index | NUL-delimited staged status plus staged Git object digest | Pass |
| Worktree | Unstaged file state and stable content digest | Pass |
| Untracked | `--untracked-files=all` plus stable content digest | Pass |
| Rename/copy | Two-path porcelain/name-status parsing | Pass |
| Delete | Explicit deleted change kind | Pass |
| Type change | File/symlink type transition | Pass |
| Conflict | Unmerged porcelain records and diagnostic | Pass |
| Detached HEAD | No fabricated branch; detached diagnostic | Pass |
| Linked worktree | Shared repository ID, distinct worktree ID | Pass |
| Submodule state | Dirty, uninitialized, and conflict boundaries | Pass |
| Embedded repository | Normalized directory boundary and partial status | Pass |
| Git unavailable | Error Snapshot, never an empty complete Snapshot | Pass |
| Non-repository | Error Snapshot | Pass |
| Unborn HEAD | Explicit error Snapshot | Pass |
| Invalid UTF-8 path | Fatal decode and error Snapshot | Linux-only test |

## 4. Consistency and race model

One capture uses two repository samples.

The first sample records:

- HEAD;
- Index entries;
- porcelain v2 Worktree/Untracked state;
- ignore configuration;
- stable content digests for readable changed files.

The final sample repeats those observations before the Snapshot is published.
The capture becomes `partial` when any of the following changes:

- HEAD commit;
- relevant Index digest;
- porcelain state;
- stable Worktree/Untracked content digest;
- sensitive-file non-content metadata;
- ignore configuration.

Regular files are opened without following the leaf symlink, checked against
the resolved file identity before any bytes are consumed, streamed in bounded
chunks, and checked again after the read. A path replaced by a symlink after
resolution is rejected before replacement content is consumed.

Every concurrently started Git query is settled before an error is returned.
This prevents one rejected query from leaving sibling child processes active
past the capture boundary.

Deterministic regression coverage includes:

- content changing during a chunked read;
- an already modified file changing after the first sample while remaining
  the same porcelain `M` state;
- an untracked file changing while remaining `?`;
- path replacement with an external symlink;
- HEAD change after the first sample;
- Index change after the first sample;
- ignore-file change after the first sample.

## 5. Privacy and path handling

- Git is invoked through argv arrays without a shell.
- Baseline revisions reject option-like and control-character input.
- Git paths use NUL-delimited protocols.
- `.understand-code/**` is excluded from source-state identity.
- Public-contract-incompatible paths produce an explicit limitation.
- Sensitive paths remain visible in the change inventory but are never opened
  for content analysis.
- Sensitive-file metadata contributes only to a private state digest.
- Legacy Artifact reads remain within the canonical repository root, reject
  symlink paths, and enforce a configurable size ceiling.

## 6. Change taxonomy

The fixed taxonomy is:

- `NONE`
- `FORMATTING_OR_COMMENT`
- `BODY_LOGIC`
- `SIGNATURE`
- `DEPENDENCY`
- `TOPOLOGY`
- `UNKNOWN`

Parser evidence takes precedence. Without parser proof, changed source is
classified conservatively as `UNKNOWN`; byte heuristics do not claim that a
semantic modification is formatting-only.

`classifyRepositoryChanges()` carries per-change parser signals through the
batch API. `BODY_LOGIC` therefore reaches `decideGraphRefresh()` and can never
produce a no-refresh decision.

`GraphRefreshDecision` answers how much index work is required.
`ChangeRiskAssessment` independently answers how risky review is. Neither
field is derived from the other.

## 7. Artifact Freshness DAG

Five required Artifact families are always represented:

- Graph
- Wiki
- Evidence
- Diff
- Task

The evaluator detects and propagates:

- missing, partial, stale, and error state;
- dangling dependencies;
- dependency cycles;
- duplicate node IDs;
- Snapshot mismatch;
- dependency degradation;
- invalid Manifest dependency/digest semantics.

When a current descriptor exists, historical descriptors remain queryable in
the DAG but do not degrade the current family root.

## 8. Legacy compatibility and mismatch detection

| Legacy input | Freshness check | Result |
|---|---|---|
| Graph | structure, commit, current Worktree | Pass |
| Meta | structure and commit | Pass |
| Fingerprints | structure and commit | Pass |
| Wiki V1 | registered structure and source commit | Pass |
| Wiki V2 Index | structure, source commit, Graph digest | Pass |
| Wiki V2 Search | structure and generation identity | Pass |
| Wiki V2 Document Traces | structure and generation identity | Pass |
| Wiki V2 Generation Report | structure, commit, Graph digest, generation identity | Pass |
| Mixed Wiki V2 set | different `generatedAt` values become stale | Pass |
| Diff Overlay | base/target commit | Pass |
| Commit-only Diff with Worktree changes | becomes stale | Pass |
| Host verifier | can narrow built-in acceptance, never widen it | Pass |

WP2 reports compatibility and freshness only. It does not rewrite legacy
files.

## 9. Repo Pulse behavior

Repo Pulse contains:

- repository identity and Git relationship;
- capture status and limitations;
- change counts by source and kind;
- all five Artifact-family freshness values;
- parser and call-graph completeness;
- index refresh recommendation;
- structured errors and unknowns;
- deterministic reasons.

Important fail-closed cases:

- Git error produces `unknown`.
- Missing Graph produces `not_ready`.
- Missing Wiki permits an explicit partial state.
- Partial Snapshot cannot produce fresh Pulse.
- Stale Evidence, Diff, or Task with a fresh index retains
  `recommendedRefresh: "none"` but includes an explicit downstream
  recomputation reason.

## 10. Local verification

Package verification on 2026-07-28:

- build: passed;
- source typecheck: passed;
- test typecheck: passed;
- Vitest: 4 files passed, 67 tests passed;
- platform condition: 1 Linux-only non-UTF-8 filename test skipped on macOS;
- Snapshot race suite: 3 consecutive passes;
- `git diff --check`: passed;
- conflict-marker scan: passed.

Real-worktree probe on Apple M3 / Node v26.0.0:

- 306 visible changes, including an embedded untracked repository boundary;
- 7 runs: 312.9–473.5 ms;
- median: 346.4 ms;
- every run returned the same explicit partial boundary state.

The timing is diagnostic evidence for the current checkout, not the WP8
release benchmark.

Exact staged-tree verification:

- Git tree: `f8e50286876a64e21e51c2b60ef40089969f5734`;
- materialized in a clean detached temporary worktree;
- `pnpm install --frozen-lockfile`: passed;
- root `pnpm quality`: passed;
- temporary worktree removed after verification.

## 11. Residual boundaries

- Raw non-UTF-8 Git path behavior is exercised only on Linux.
- An untracked embedded repository is represented as one partial boundary;
  nested contents are not claimed complete.
- A repository without HEAD is unsupported in V1 and returns error.
- Built-in legacy verifiers are structural. A host may supply stricter Core
  verifiers for domain-specific validation.
- Snapshot consistency is optimistic and double-sampled; WP2 does not lock the
  user's Git worktree.
- `recommendedRefresh` is index-specific in V1. Downstream Task/Evidence/Diff
  recomputation remains an explicit reason until a later per-family action
  contract is introduced.

## 12. Closure checklist

- [x] Package implementation complete.
- [x] Git-state and error fixtures pass.
- [x] Stable-content and end-of-capture race fixtures pass.
- [x] Taxonomy and BODY_LOGIC path pass.
- [x] Legacy Graph/Wiki/Diff mismatch fixtures pass.
- [x] Repo Pulse contract fixtures pass.
- [x] Local performance probe recorded.
- [x] Exact staged tree installs with `pnpm install --frozen-lockfile`.
- [x] Exact staged tree passes the root `pnpm quality` gate.
- [ ] WP2 feature commit is pushed independently.
- [ ] Remote GitHub Actions quality gate passes that commit.

WP2 is not closed until the two remaining items are recorded.
