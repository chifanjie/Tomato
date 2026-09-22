# Understand Code CLI

如果你是第一次使用 Understand Code，请先看源码仓库根目录的 `README.zh-CN.md`；本文件描述 stdio MCP、任务知识写作、独立工作台与开发者检查。

This package builds the self-contained Understand Code CLI and stdio MCP
server. The executable has no runtime npm dependencies and is shared by the
Codex CLI and Claude Code Host installations.

## Start the MCP server

The root must be the exact absolute path of the Git worktree top level. A
direct invocation without a Provider selector uses the supported
`local_durable_v1` profile on macOS and Linux:

```sh
understand-code mcp --stdio --root /absolute/path/to/worktree
```

An installer-owned Host wrapper selects a verified Provider installation and
starts the strong profile with:

```sh
understand-code mcp --stdio \
  --root /absolute/path/to/worktree \
  --installation-root /absolute/path/to/provider-installation
```

The full MCP surface contains twelve versioned tools:

| Tool | Behavior |
| --- | --- |
| `get_repo_pulse` | Reads the published Repo Pulse and its exact Repository Snapshot. |
| `refresh_index` | Captures and publishes a path-safe Snapshot, Pulse, Graph, and Wiki cut. |
| `index_job` | Reads or cancels a durable background index job for this bound local repository. |
| `build_task_brief` | Creates or idempotently resumes an evidence-backed Task Brief. |
| `get_task_brief` | Reads one paginated section from a managed Task Brief; `analysis` returns complete persisted analysis Claims, including conclusions and evidence IDs. |
| `update_task` | Applies an optimistic, idempotent Task lifecycle action. |
| `check_change` | Commits an evidence-backed comparison of the plan and actual Snapshot. |
| `record_verification` | Records a caller-executed verification result; it never runs the command. |
| `get_evidence` | Reads bounded, paginated Task evidence. |
| `search_context` | Searches Task-pinned Graph and Wiki context. |
| `trace_impact` | Reads bounded, paginated impact paths. |
| `open_workbench` | Mints a one-time Task-first Workbench deep link. |

Every tool returns a versioned structured result. Missing, stale, corrupt, or
untrusted state returns a stable fail-closed error. An explicitly selected
Provider still requires its verified Linux installation and never falls back to local storage. Large results use
bounded pages, cursors, and explicit truncation metadata.

The full server also returns shared Task workflow `instructions` in MCP
`initialize`, so Codex and Claude receive the same revision, verification and
knowledge-publication guidance. This is guidance, not a capability grant; the
local profile supports durable Tasks; the Provider strong-writer lock is unchanged. The limited Preview surface includes background job control and receives the corresponding polling and resume instructions.

## Local Task workflow

`build_task_brief` accepts `{ task, expectedRevision: 0, actor, idempotencyKey }`.
For an already indexed repository it persists or replays a real Task immediately.
For a repository without an index, the first MCP call starts a detached worker
and returns `result.status: "waiting_for_index"`, a `job.jobId` and `pollAfterMs`.
No Task exists at this point. The Host completes the workflow through MCP:

1. Call `index_job` with `{ action: "status", jobId }` after the polling delay.
   Limit a batch to 10 checks. If still active, report the job ID and phase, then
   yield or wait at least 10 seconds before another batch. A Host without a wait
   capability should yield with the job ID instead of issuing immediate polls.
2. When `result.job.status` is `completed`, repeat `build_task_brief` with the
   **identical original arguments and idempotencyKey** to create or replay the Task.
3. To cancel, call `index_job` with `{ action: "cancel", jobId }` and wait for
   `cancelled`. If it already committed, status is `completed` and its output remains valid.
4. After a failure or interruption, inspect `phase`, fix the cause, then repeat
   the original build request to start a new job. Legacy-format failures require
   the explicit archive/recover flow below. Do not automatically restart failed
   jobs in a loop.

The worker survives the Host closing. Reconnect to the same repository and
query its saved `jobId`, or omit the ID to query the latest job. A completed
job’s `snapshotId` identifies its committed publication; a later refresh can
publish another snapshot, so read the current Task snapshot before subsequent actions. Concurrent first
requests reuse the active job. The job tool cannot address another repository
and does not bypass a production Provider gate. No target-repository npm install
or manual shell prewarming is required. Use the eventual returned task ID with `get_task_brief`, `search_context`, `trace_impact`,
`get_evidence`, and `open_workbench`. Workbench `/tasks` discovers recent Tasks;
source conclusions are recorded through `update_task` / `record_analysis` with
real Evidence IDs and a snapshot pin. Static reference Wiki is labeled diagnostic
and does not establish business semantics without host analysis.

For a large cold repository, the installed CLI can prepare the index in a
detached process before the Host creates a Task:

```sh
understand-code index --root /absolute/path/to/worktree --background
understand-code index --root /absolute/path/to/worktree --status
# Optional: request a stop before the next atomic commit.
understand-code index --root /absolute/path/to/worktree --cancel
```

The first command returns a job ID immediately. It survives the launching
terminal/Host closing; progress and the final snapshot are persisted outside
the source tree. Repeat `--background` to reuse an active job or retry a stopped
one. `--status` and `--cancel` also accept `--job-id <ULID>`. Wait for `completed`
before creating a Task. A stopped worker is reported as `interrupted`, and
previously committed artifacts remain available. These commands require the
built or installed self-contained CLI, not a TypeScript development runner.

The default first `build_task_brief` uses this same background mechanism. An
explicit `refresh_index` still performs the requested refresh synchronously.
The ordinary Codex TOML registration template sets `tool_timeout_sec = 900` for
such long calls; no installer changes the user's global timeout. Plugin timeout
support and Claude defaults depend on the Host.

For synchronous operations, a Host-supplied MCP `progressToken` receives stage
notifications, and `notifications/cancelled` requests cooperative cancellation
at operation checkpoints. `ping` and `index_job` status/cancel remain responsive
while tools run. A stage counter is not a percentage or completion-time estimate.
Once a first-index job has been detached, cancelling its completed launch request
does not stop it: use `index_job` cancel. Cancellation preserves the last complete
published snapshot; it does not interrupt an atomic commit in progress.

After the host edits source, `refresh_index` captures the actual snapshot.
Transition the Task from `in_progress` to `check_required` after that refresh.
`check_change` uses the local input schema, and `record_verification` records the
host's actual result. `refresh_task_context` / `rebase_task` are `update_task`
actions for stale local Tasks. Stored Tasks survive MCP restarts and can be read
by another host at the same repository. Atomic file replacement, file/directory
fsync, cross-process locks, content hashes, and revision checks protect local
storage; this is a single-user local profile, not the Linux Provider isolation
or rollback protection profile.

Doctor reports `capabilities.localTasks`, `repositoryArtifacts`, `taskBackend`
and `sessionConnection` separately. `--host codex` registration health cannot
prove that the current conversation connected; a successful MCP tool call does.

## Reopen the Workbench without a chat Host

After a Task has been persisted, start a separate local reader:

```sh
understand-code workbench --root /absolute/path/to/worktree --no-open
```

Open the printed single-use local URL. Add `--task-id "<TASK_ULID>"` to open a
specific existing Task; omit it for task history. Replace `<TASK_ULID>` with the
actual 26-character ID. Without `--no-open`, the CLI also tries to open the
browser. Keep this CLI running while reading and stop it with Ctrl+C. It can
outlive the MCP/chat process; stopping the reader stops its HTTP session but
does not delete Tasks. Run the command again for a fresh link. This uses the
macOS/Linux local Task runtime and is separate from the static
`understand-code-preview --root` viewer.

## Task knowledge lifecycle

The installed CLI includes the formal workflow and file, topic, and featured-page writer guides;
no separate slash-skill installation is required. First create and analyze a
real local Task through the Host. Replace the root and Task ID below with its
actual values:

```sh
understand-code knowledge --root /absolute/path/to/worktree --task-id "<TASK_ULID>" --guide
understand-code knowledge --root /absolute/path/to/worktree --task-id "<TASK_ULID>" --prepare-file-docs
```

Use the same absolute worktree root and Task ID on every phase. The source and
Task snapshot must match the active index. Drafts stay in
`.understand-code/knowledge-drafts/<taskId>/`; preparation does not publish a
Wiki or manufacture business explanations. The Host follows the printed guide:

1. Lease file work with `--lease-file-batch --worker-id writer-1`, read its
   source, and write the specified `.intermediate/file-doc-batch-<batchIndex>.json`.
2. Record each result with `--complete-file-batch --worker-id writer-1
   --batch-index <n> --result-status succeeded`; repeat until no batch remains.
3. Run `--merge-file-docs`, then `--prepare-topics`. Lease and complete topic
   batches with `--lease-topic-batch` / `--complete-topic-batch` and the same
   worker/batch flags, writing the topic JSON described by the guide. Topic
   preparation also writes `.intermediate/featured-plan.json`.
4. Follow the [featured-page guide](../../agents/kb-featured-writer.md) included
   in the installed `--guide` output to
   write every page in that plan, including its required sections and real
   source evidence. Write `.intermediate/featured-writer-output.json` with each
   plan entry's exact `documentId` and `documentPath`. Do not replace authored
   overviews, flows, modules, or capability pages with deterministic templates.
5. Run `--finalize` to validate and assemble the draft. It requires valid
   featured-page output as well as the existing file/topic source bindings and
   publication-quality checks. Use `--retry` to inspect concrete validation
   failures, including the featured writer retry plan, and correct the output.

To regenerate only the featured-page plan, use `--prepare-featured`. It does
not overwrite `.intermediate/featured-writer-output.json`; compare existing
output with the current plan and source evidence before reusing it.

These flags belong to `understand-code knowledge --root … --task-id …`.
Existing file or topic work is protected from repeated preparation; resume its
lease/merge/finalize workflow instead of starting preparation again. A source
change requires refreshing and checking the Task before continuing with a
draft bound to that source. The CLI does not execute verification commands.

After the actual Snapshot has been checked for a Task, `refresh_index` with
`mode: "full"`, its exact `expectedSourceSnapshotId`, and
`knowledge: { action: "stage", taskId, expectedTaskRevision }` saves a persistent
candidate without publishing it or changing the Task. Retain the returned
`candidateGenerationId`. Pending Graph/Wiki is read-only, not current Task
evidence; stage success is not proof of review.

Run the required verification in the Host, record the real result, and complete
the supported `update_task` transition to `verified`. Then use the same
Snapshot and candidate ID with
`knowledge: { action: "publish", taskId, expectedTaskRevision, candidateGenerationId }`
and `mode: "full"`. Use the current Task revision, not the staging revision.
Changed source requires a new Check and candidate; never use an ordinary full
refresh to overwrite Task-published knowledge.

`open_workbench` opens the bound Task and existing knowledge views. Candidate
discovery and read-only preview HTTP interfaces are implemented, but their
review controls are connected to the read-only Task workbench. Do not claim a
complete credentialed real-Host session from API or browser tests alone.

To discard an unneeded draft candidate, supply its exact generation ID and
owning Task. This does not delete repository source or the Task:

```sh
understand-code knowledge --root /absolute/path/to/worktree --task-id "<TASK_ULID>" --discard-candidate --candidate "<GENERATION_ID>"
```

Published candidates are safely archived and do not consume the pending-draft
capacity; their publication replay remains available. To remove interrupted
temporary candidate writes, use:

```sh
understand-code knowledge --root /absolute/path/to/worktree --task-id "<TASK_ULID>" --cleanup-interrupted
```

Both commands require an explicit root and a valid existing local Task. Cleanup
applies to interrupted temporary writes in the bound repository and preserves
complete candidates; it is not a source-file cleanup command.

## Language and relation boundaries

Language detection or a definition in the Graph does not imply that every call
or import can be resolved. The local index uses conservative static evidence:

| Area | Resolved cases and limits |
| --- | --- |
| TypeScript / JavaScript imports | Relative imports and in-inventory `tsconfig`/`jsconfig` JSONC `paths`, `baseUrl`, and relative `extends`. Workspace packages require a unique package name and an explicit `workspace:` dependency on the importer. Package `exports`/`main` and explicit `rootDir`/`outDir` mappings can connect built entrypoints to source. Ambiguous conditional exports, undeclared packages, and npm-package `extends` are not guessed. |
| Python / Rust calls | Direct calls to a unique top-level function in the same file. Methods and cross-module targets are not resolved. Shadowing, dynamic names, nested definitions and other ambiguous bindings remain unresolved. |
| Java calls | Conservative, uniquely determined static call bindings are supported. Virtual dispatch, inherited targets and ambiguous overloads remain unresolved. |
| Ruby / PHP / C / C++ / C# calls | Definitions and call locations are extracted, but call targets are not currently bound. |

Graph `callResolution.limitations` records supported-parser limitations. A
missing edge is not proof that code is unrelated; the Host must read the
relevant source and record uncertainties before making impact or business
claims.

## Authority and write boundary

- `--root` is required exactly once. Relative paths, subdirectories that would
  expand to a parent repository, duplicate roots, and unavailable roots do not
  bind a session.
- MCP Roots are an additional membership check. They never replace or expand
  the explicit root authority.
- Ambient Git authority variables are ignored while resolving and capturing
  the bound worktree, then restored for the host process.
- Strong capture is admitted only through the installed SafeGit and Provider
  profile for the exact supported OS, filesystem, mount, and principal.
- MCP never writes repository source files and never executes verification
  commands. It writes only managed `.understand-code/**` artifacts after the
  selected local or Provider runtime and optimistic revision checks succeed.
- In `mcp --stdio` mode, stdout is reserved for newline-delimited JSON-RPC
  frames. Diagnostics on stderr do not expose source content or secrets.

## Preview compatibility

The separately compiled Preview Candidate remains pinned to its original three
tools (`get_repo_pulse`, `build_task_brief`, and `get_task_brief`) so its cold
installation contract is byte- and schema-stable. That restricted surface is
not the full Host Alpha profile described above.

## Development checks

```sh
pnpm --filter @understand-code/cli typecheck
pnpm --filter @understand-code/cli test
pnpm --filter @understand-code/cli build
```

Cold-pack tests install the generated artifact outside the monorepo. The
Linux/ext4 production gate additionally verifies the isolated Provider,
SafeGit, Host selector, and strong mutation path.

## Recover old artifacts or restart writer work

Recovery is explicit and local. Close this repository's MCP Hosts and Workbench
readers first. If a background index is running, use `index --status` and
`index --cancel`, then wait for it to stop. Recovery refuses active write locks.
It never runs automatically when opening an old repository. Current local MCP
requests and writer phases hold operation markers so recovery cannot switch the
root beneath an in-flight request, and requests arriving during recovery are
refused. This is still an offline operation: old CLI versions and already-open
readers must be stopped first.

For an unsupported or damaged old `.understand-code` directory:

```sh
understand-code recover --root /absolute/path/to/worktree --rebuild
```

The CLI first moves the complete old directory into the worktree's actual Git
administration directory, under `understand-code-recovery/<recovery-id>/state`.
It prints the backup location and restore command before rebuilding. It then
indexes current source and creates a new local Task, printing a Workbench command
for that Task. Old Markdown, Task records, writer drafts and verification records
remain in the archive; they are historical references, not newly verified
conclusions. Even an unreadable old artifact manifest can be preserved this way.
No source files are changed, and the archive is outside source indexing.

To reverse a recovery, use the printed ID:

```sh
understand-code recover --root /absolute/path/to/worktree --restore recovery-0123456789abcdef0123456789abcdef
```

Restore retains the selected backup and archives the current state before
replacing it. The new backup ID makes the restore itself reversible. If rebuild
fails, the printed original backup remains usable with this command; inspect
and fix the indexing failure before retrying. Backups belong to the Git
administration directory of this worktree: copy them elsewhere before removing
the worktree or its Git metadata.

For an existing Task whose source changed, first ask the Host to run
`refresh_index`, then `update_task` with `refresh_task_context` or `rebase_task`
and the actual current snapshot. To start writer work again without deleting
the old draft:

```sh
understand-code knowledge --root /absolute/path/to/worktree --task-id "<TASK_ULID>" --restart-draft
```

This archives the entire old draft, including handwritten files, prints its
restore command, and prepares new file tasks bound to current source. It refuses
to move the old draft while the Task still points to stale source. `--retry`
remains available to inspect existing writer failures after source changes.
Restoring an old draft does not change its source binding; to publish it, either
return to its matching source and Task snapshot or restart from current source.
