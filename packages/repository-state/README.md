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
- Provides a descriptor-bound SafeGit bootstrap candidate that validates an
  ordinary `.git` directory layout or linked-worktree control relationship,
  retains native handle custody, and never launches Git.
- Promotes that opaque binding only after descriptor-relative repository config,
  local-object-database, and files-ref-backend admission succeeds.
- Derives installation-keyed repository/worktree/root identities and separately
  promotes an installation-pinned, descriptor-retained exactly-empty hooks
  directory without exposing either the key or host filesystem identities.

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

## SafeGit descriptor-bound bootstrap candidate

`bootstrapSafeGitDescriptorBoundCandidateV1()` performs a bounded, read-only
preflight before a future strong identity can be derived. It rejects relative
roots, symbolic-link control entries, unsafe owners or modes, malformed pointer files,
external administrative targets, broken linked-worktree backpointers, and
binding changes observed before capability publication. A successful result
contains an opaque, explicitly closable capability with fail-closed
`revalidate()` and a path-redacted inspection projection. Native
descriptor-relative traversal retains the repository binding without exposing
paths, file descriptors, or native handles.

Successful results carry the distinct
`descriptor_bound_safe_git_bootstrap_candidate_v1` profile; the earlier
filesystem-only candidate API is intentionally replaced rather than silently
changing its V1 contract.

Call `capability.bindRepositoryControl()` to request the next, independently
versioned `descriptor_bound_safe_git_repository_control_v1` proof. The native
reader operates only through retained descriptors. It verifies strict local
repository/worktree config, rejects includes and executable-valued controls,
rejects alternate/promisor/partial-clone/grafts/replace-object state, binds a
local `objects` hierarchy, and admits only the files ref backend.

After repository control is bound, call `capability.bindRepositoryIdentity()`
to request the separately versioned
`descriptor_bound_safe_git_repository_identity_v1` proof. The Provider
installation-identity authority derives descriptor-bound repository,
worktree, and root HMAC identities without exposing its key or canonical path
bytes. This result exposes only branded path-safe IDs, `sha1 | sha256`, and
fixed verification labels; no path, descriptor, inode, config bytes, ref, or
object identifier crosses the API. Later `revalidate()` calls recheck the
current promotion stage, including the installation-keyed identity once bound,
and fail closed on drift.

After repository identity is bound, call `capability.bindEmptyHooksDirectory()`
to request the separately versioned
`descriptor_bound_safe_git_empty_hooks_v1` proof. A newly created installation
root receives one fixed native-owned empty directory whose POSIX identity and
empty-entry set are HMAC-pinned into the Installation Identity state. Native
retains and revalidates its complete descriptor chain. Existing or legacy
installation roots are never supplemented or adopted; if the authenticated pin
is absent, promotion fails closed with zero writes. The public projection says
only `emptyHooksDirectory: "verified"` and never exposes the directory path,
device, inode, or token.

This is still not the complete SafeGit adapter. Handle-bound execution, the
fixed invocation environment, OS sandbox/resource containment, and strong
writes remain explicitly `locked`. It is not connected to the
legacy Snapshot producer and does not authorize Git execution, Provider I/O,
or any public strong capability.

## Security and boundaries

The legacy Snapshot producer invokes Git only through `execFile` argv arrays.
That legacy path is not SafeGit authority. Paths come from `-z`
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
