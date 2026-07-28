# @understand-code/repository-state

The repository-state package is the trust boundary for Agent-native repository
inspection. It produces the exact `RepositorySnapshotV1` and `RepoPulseV1`
payloads defined by `@understand-code/contracts`.

## Capabilities

- Captures `baseline..HEAD`, Index, Worktree, Untracked, rename/copy/delete,
  type-change and merge-conflict state with NUL-delimited Git protocols.
- Distinguishes a proven-clean repository from Git unavailable/error.
- Provides deterministic repository, worktree, snapshot and state digests.
- Diagnoses detached HEAD, linked worktrees, dirty/uninitialized submodules,
  nested-repository boundaries, capture races and public-contract-incompatible
  paths.
- Filters `.understand-code/**` managed artifacts so Artifact Store writes do
  not make the source repository stale.
- Classifies semantic changes with the fixed P0 taxonomy and keeps graph
  refresh cost separate from change risk.
- Evaluates Graph/Wiki/Evidence/Diff/Task freshness through an explicit DAG,
  including legacy Graph/Meta/Fingerprint, Wiki V1/V2 support files and Diff
  Overlay mismatch detection.

## Snapshot

```ts
import {
  getRepositorySnapshot,
  getRepositorySnapshotDetailed,
} from "@understand-code/repository-state";

const snapshot = await getRepositorySnapshot("/canonical/repository", {
  baselineRef: "origin/main",
});

const capture = await getRepositorySnapshotDetailed("/canonical/repository");
console.log(capture.snapshot.captureStatus, capture.diagnostics);
```

`getRepositorySnapshot()` never converts a Git failure into an empty change
list with `captureStatus: "complete"`. Missing Git, a non-repository root, an
invalid baseline and required Git query failures all yield a contract-valid
error snapshot.

The baseline is `HEAD` when omitted. Callers that need branch/task committed
changes must provide the task baseline explicitly.

## Repo Pulse

```ts
import {
  buildRepoPulse,
  inspectArtifactFreshness,
} from "@understand-code/repository-state";

const artifacts = await inspectArtifactFreshness(
  capture.canonicalRoot,
  capture.snapshot,
);
const pulse = buildRepoPulse({
  snapshot: capture.snapshot,
  git: capture.git,
  artifacts,
  completeness: {
    parser: { status: "complete", coverage: 1, reasons: [] },
    callGraph: { status: "complete", coverage: 1, reasons: [] },
  },
});
```

Every Pulse reports all five required artifact families. Git errors force
`status: "unknown"` and do not claim freshness.

`recommendedRefresh` is specifically the repository index refresh action
(`none`, `incremental`, or `full`). It does not disguise Task, Evidence, or
Diff recomputation as `refresh_index`. When one of those downstream families is
stale but the index remains current, Pulse keeps `recommendedRefresh: "none"`
and records an explicit downstream-recomputation reason.

## Security and boundaries

Git is invoked only through `execFile` argv arrays. Paths come from `-z`
protocols, and repository file reads reject symbolic-link parents. Git can
represent control characters that the public V1 path contract intentionally
rejects; those paths produce a partial capture plus a non-sensitive diagnostic
instead of being silently treated as clean.

Legacy artifact inspection is read-only, remains inside the canonical root,
and has a configurable size ceiling. It reports compatibility/freshness; it
does not migrate or rewrite legacy files. Built-in Graph/Meta/Fingerprint,
Wiki V1/V2 support-file and Diff structural verifiers run before freshness is
claimed. Core can provide stricter `legacyVerifiers`; rejection or verifier
failure is fail-closed.

An embedded untracked repository reported by Git as `site/` is normalized to
the contract-valid boundary path `site` and marks the capture partial because
its nested contents are not enumerated. Non-UTF-8 Git paths fail closed rather
than being decoded with replacement characters.

Sensitive changed paths such as `.env`, nested credentials, SSH/cloud config
and private-key formats remain visible in the changed-path inventory but are
not opened for content analysis and never receive a public `contentDigest`.
Their non-content filesystem metadata contributes only to the private state
fingerprint, and the capture records an explicit filtering limitation.
