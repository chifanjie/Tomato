# Understand Code CLI

This package is the first installable, source-tree-readonly Alpha slice of
Understand Code for Coding Agents. It builds one self-contained Node.js
executable with no runtime npm dependencies.

## Start the MCP server

Prerequisites are Node.js 22 or newer, Git on `PATH`, and an Understand Code
Artifact Store already published for the target worktree. The root must be the
exact absolute path of the Git worktree top level:

```sh
understand-code mcp --stdio --root /absolute/path/to/worktree
```

The Alpha advertises exactly three tools:

| Tool | Behavior |
| --- | --- |
| `get_repo_pulse` | Reads the published Repo Pulse and the exact Repository Snapshot it evaluated. |
| `build_task_brief` | Creates or idempotently resumes a Task Brief from published repository context. |
| `get_task_brief` | Reads one paginated section from a managed Task Brief. |

If the required Snapshot, Pulse, or task context is absent, stale, or corrupt,
the tool returns a structured fail-closed result. This command does not perform
an indexing refresh.

## Authority and write boundary

- `--root` is required exactly once. Relative paths, subdirectories that would
  expand to a parent repository, duplicate roots, and unavailable roots do not
  bind a session.
- MCP Roots are an additional membership check. They never replace or expand
  the explicit root authority.
- Ambient Git authority variables are ignored while resolving and capturing
  the bound worktree, then restored for the host process.
- Repository source files are never written. `build_task_brief` may write only
  managed `.understand-code/**` artifacts through the Artifact Store; the two
  read tools do not modify source state.
- Stdout is reserved for newline-delimited JSON-RPC frames. Diagnostics on
  stderr are generic and do not expose repository paths or internal errors.

## Alpha boundary

This package does not yet include the Codex or Claude host adapter, an indexing
refresh command, strong Provider authority, Change Check, Verification, or the
remaining MCP tools. Those capabilities stay unadvertised until their own
quality gates close.

## Development checks

```sh
pnpm --filter @understand-code/cli typecheck
pnpm --filter @understand-code/cli test
pnpm --filter @understand-code/cli build
```

The cold-pack test installs the generated tarball outside the monorepo and runs
the complete three-tool stdio flow against a disposable Git repository.
