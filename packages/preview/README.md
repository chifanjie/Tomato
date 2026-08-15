# Understand Code Preview Candidate

This is a deliberately small, installable Preview Candidate. One tarball provides
both a local, token-protected Graph/Wiki snapshot viewer and the existing read-only
stdio MCP slice.

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

The same installation exposes the three-tool MCP command:

```sh
understand-code mcp --stdio --root /absolute/path/to/worktree
```

This Preview is read-only. It does not implement Acceptance current selection,
Migration, Provider Gate/daemon installation, Change Intelligence verification,
refresh/index, Doctor, upgrade/rollback/uninstall, or strong writes. The process
token is a Preview-only, query-parameter, local process-lifetime access token. In
root mode it is bound to the clean repository snapshot; demo mode serves only the
embedded fixture. It is not the formal local-server token contract, a Host Rendezvous
token, a completed lifecycle token, or a one-time security token.

The candidate's UI evidence is the same-tarball HTTP/CSP contract plus the existing
Dashboard test suite. It does **not** claim that the formal real-browser Surface E2E
gate is closed. Production Host token/Rendezvous integration and real-browser E2E
remain blocking work for steps 16/17.

## Preview commands

```text
understand-code-preview --demo [--port 0] [--no-open]
understand-code-preview --root <absolute-worktree> [--port 0] [--no-open]
understand-code-preview --help
understand-code-preview --version
```

The server binds to `127.0.0.1` only. Data endpoints require the printed token;
static HTML and JavaScript do not contain repository data.
