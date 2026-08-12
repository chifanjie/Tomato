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
current Git `HEAD`. A repository without Wiki V2 still opens the Graph surface and
reports Wiki as missing instead of presenting stale Wiki content.

The same installation exposes the three-tool MCP command:

```sh
understand-code mcp --stdio --root /absolute/path/to/worktree
```

This Preview is read-only. It does not implement Acceptance current selection,
Migration, Provider Gate/daemon installation, Change Intelligence verification,
refresh/index, Doctor, upgrade/rollback/uninstall, or strong writes. The process
token is a local process-lifetime access token; it is not a completed lifecycle or
one-time security token.

## Preview commands

```text
understand-code-preview --demo [--port 0] [--no-open]
understand-code-preview --root <absolute-worktree> [--port 0] [--no-open]
understand-code-preview --help
understand-code-preview --version
```

The server binds to `127.0.0.1` only. Data endpoints require the printed token;
static HTML and JavaScript do not contain repository data.
