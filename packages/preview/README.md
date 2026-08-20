# Understand Code Alpha Preview

One installable tarball provides the current Understand Code Alpha vertical: a
local Graph/Wiki viewer, the full stdio MCP tool surface, and the managed
install/Doctor/uninstall lifecycle. Runtime npm dependencies are bundled; Node.js
22 or newer and Git on `PATH` are required.

```sh
npm install -g ./understand-code-preview-0.1.0-preview.1.tgz
understand-code-preview --demo
```

The command prints a local URL. Open it in a browser. `--demo` is self-contained and
works from an empty directory. To inspect a repository that already has published
Understand Code artifacts, use:

```sh
understand-code-preview --root /absolute/path/to/worktree
```

`--root` accepts only the canonical Git worktree top-level. It fails closed when the
knowledge graph is missing, malformed, or its published revision disagrees with the
current Git `HEAD`. It also requires a clean launch snapshot: staged, unstaged,
untracked, renamed, deleted, conflicted, or incompletely sampled non-product paths
are rejected. Managed `.understand-code/**` publication artifacts are excluded from
that repository-state identity. Every token-protected data request revalidates the
launch `HEAD`/Index/Worktree/Untracked snapshot and fails closed if it drifted. A
repository without Wiki V2 still opens the Graph surface and reports Wiki as missing
instead of presenting stale Wiki content.

The same installation exposes the full Alpha MCP command:

```sh
understand-code mcp --stdio --root /absolute/path/to/worktree
```

The MCP server advertises `get_repo_pulse`, `build_task_brief`, `get_task_brief`,
`update_task`, `check_change`, `record_verification`, `open_workbench`,
`get_evidence`, `search_context`, `trace_impact`, and `refresh_index`. A full
refresh can create the managed Graph/Wiki/Pulse artifacts for a real repository.
Source changes remain external: Understand Code records and checks a change, but
does not edit repository source files or unlock strong writes.
Verification records are externally reported evidence. The Alpha persists and
replays their command descriptor, exit code, output digest, duration, claims, and
Snapshot binding; it does not independently execute or attest the reported command.

For a managed local installation and host wrapper:

```sh
understand-code install --root /absolute/path/to/understand-code-home --host codex
understand-code doctor --root /absolute/path/to/understand-code-home
/absolute/path/to/understand-code-home/bin/understand-code --root /absolute/path/to/worktree
understand-code uninstall --root /absolute/path/to/understand-code-home
```

Use `--host claude` for the Claude wrapper. Ending MCP stdin stops the stdio
server; stopping `understand-code-preview` terminates its loopback HTTP server.
Install, upgrade, rollback, Doctor, and uninstall operate only on the explicitly
selected managed installation root and fail closed when owned files are replaced
or modified.

The Graph/Wiki process token remains a Preview-only, query-parameter, local
process-lifetime access token. In root mode it is bound to the clean repository
snapshot; demo mode serves only the embedded fixture. It is not the formal
Host Rendezvous token or a one-time security token.

Provider Authority, the execution fence, global rollback anchoring, and
production cross-platform hardening are not complete. Provider-backed strong
writes therefore remain locked. The bundled CLI may contain internal Provider
lifecycle candidates, but this Alpha does not claim that they are ready for
production use or that a live Provider execution path has been established.

The Alpha's UI evidence is the same-tarball HTTP/CSP contract plus the existing
Dashboard test suite. It does **not** claim that the formal real-browser Surface
E2E, release, distribution, or cross-platform gates are closed.

## Preview commands

```text
understand-code-preview --demo [--port 0] [--no-open]
understand-code-preview --root <absolute-worktree> [--port 0] [--no-open]
understand-code-preview --help
understand-code-preview --version
```

The server binds to `127.0.0.1` only. Data endpoints require the printed token;
static HTML and JavaScript do not contain repository data.
