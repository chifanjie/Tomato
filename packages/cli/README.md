# Understand Code CLI

This package builds the self-contained Understand Code CLI and stdio MCP
server. The executable has no runtime npm dependencies and is shared by the
Codex CLI and Claude Code Host installations.

## Start the MCP server

The root must be the exact absolute path of the Git worktree top level. A
direct invocation without a Provider selector remains on the fail-closed
read-only compatibility profile:

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
| `get_task_brief` | Reads one paginated section from a managed Task Brief. |
| `update_task` | Applies an optimistic, idempotent Task lifecycle action. |
| `check_change` | Commits an evidence-backed comparison of the plan and actual Snapshot. |
| `record_verification` | Records a caller-executed verification result; it never runs the command. |
| `get_evidence` | Reads bounded, paginated Task evidence. |
| `search_context` | Searches Task-pinned Graph and Wiki context. |
| `trace_impact` | Reads bounded, paginated impact paths. |
| `open_workbench` | Mints a one-time Task-first Workbench deep link. |

Every tool returns a versioned structured result. Missing, stale, corrupt, or
untrusted state returns a stable fail-closed error; a missing or invalid
Provider selector never falls back to a legacy writer. Large results use
bounded pages, cursors, and explicit truncation metadata.

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
  relevant strong authority and optimistic revision checks succeed.
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
