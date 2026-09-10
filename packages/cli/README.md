# Understand Code CLI

如果你是第一次使用 Understand Code，请先看源码仓库根目录的 `README.zh-CN.md`；本文件只描述低层 stdio MCP server、工具契约和开发者检查。

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

The full MCP surface contains eleven versioned tools:

| Tool | Behavior |
| --- | --- |
| `get_repo_pulse` | Reads the published Repo Pulse and its exact Repository Snapshot. |
| `refresh_index` | Captures and publishes a path-safe Snapshot, Pulse, Graph, and Wiki cut. |
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
local profile supports durable Tasks; the Provider strong-writer lock is unchanged. The original three-tool Preview
does not receive these full-profile instructions.

## Local Task workflow

`build_task_brief` accepts `{ task, expectedRevision: 0, actor, idempotencyKey }`.
For a repository without an index it initializes source analysis and persists a
real Task; no fixture or target-repository npm install is required. Use the
returned task ID with `get_task_brief`, `search_context`, `trace_impact`,
`get_evidence`, and `open_workbench`. Workbench `/tasks` discovers recent Tasks;
source conclusions are recorded through `update_task` / `record_analysis` with
real Evidence IDs and a snapshot pin. Static reference Wiki is labeled diagnostic
and does not establish business semantics without host analysis.

The first full index of a large repository can exceed two minutes and runs
inside the `build_task_brief` or `refresh_index` tool call. The ordinary Codex
TOML registration template sets `tool_timeout_sec = 900`; use that per-server
setting with the explicit repository root. Increasing a server startup timeout
does not extend an already running tool call. Plugin `.mcp.json` timeout support
and Claude's default timeout are not confirmed. Cold large-repository success
under a test runner's longer timeout does not prove the same behavior under a
default plugin installation. No installer changes the user's global timeout.

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

## Task knowledge lifecycle

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
- Stdout is reserved for newline-delimited JSON-RPC frames. Diagnostics on
  stderr are generic and do not expose repository paths or internal errors.

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
