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

It also contains self-contained Codex and Claude Code plugin marketplaces. The
installed plugins carry their own exact-version MCP executable, so Host plugin
caches do not depend on the monorepo, a globally installed Understand Code
command, or the original tarball location:

```sh
PREVIEW_ROOT="$(npm root -g)/@understand-code/preview"

codex plugin marketplace add "$PREVIEW_ROOT/dist/plugin-roots/codex" --json
codex plugin add understand-code@understand-code-alpha --json

claude plugin validate --strict "$PREVIEW_ROOT/dist/plugin-roots/claude"
claude plugin marketplace add "$PREVIEW_ROOT/dist/plugin-roots/claude" --scope user
claude plugin install understand-code@understand-code-alpha --scope user
```

Start a new Host session after installation. The Codex plugin binds to the Git
worktree containing the Host working directory; the Claude plugin binds to the
absolute `CLAUDE_PROJECT_DIR` supplied by Claude Code. Both resolve the canonical
Git worktree top-level and reject a missing or non-repository root. Ambient
`GIT_*` variables are not allowed to redirect the selected repository. The Alpha
gate validates real isolated marketplace install/list/remove operations and starts
the MCP from each Host's installed plugin cache. It does not yet claim a
credentialed, model-selected tool call inside a complete Codex or Claude chat.

It also installs the two mandatory CLI Host entrypoints from the same tarball:

```sh
understand-code-codex --root /absolute/path/to/worktree
understand-code-claude --root /absolute/path/to/worktree
```

Both entrypoints launch the bundled MCP executable and require one explicit absolute
worktree root. They do not fall back to the process working directory or to an
`UNDERSTAND_CODE_CLI` override. Codex and Claude can therefore resume the same
persisted Task even when their working directories differ. Missing, relative, or
unexpanded placeholder roots fail with `workspace_root_required`; ending stdin
stops the Host and MCP processes cleanly.

`dist/release-manifest.json`, the two
`dist/host-adapters/{codex,claude}/manifest.json` files, and the two
`dist/plugin-roots/{codex,claude}` trees bind the package, Preview, CLI, Host
entrypoint, marketplace/plugin configuration paths, product version, and the
reviewed payload SHA-256 digests. The release manifest also binds the one native
provider-peer tuple carried by this platform-specific Alpha tgz, the bundled
Server/contracts runtime, and the exact final Dashboard file inventory.
They provide Alpha artifact traceability; they are not a signature, SBOM, provenance,
or formal Release attestation.

The MCP server advertises `get_repo_pulse`, `build_task_brief`, `get_task_brief`,
`update_task`, `check_change`, `record_verification`, `open_workbench`,
`get_evidence`, `search_context`, `trace_impact`, and `refresh_index`. A full
refresh can create the managed Graph/Wiki/Pulse artifacts for a real repository.
Source changes remain external: Understand Code records and checks a change, but
does not edit repository source files or unlock strong writes.
Verification records are externally reported evidence. The Alpha persists and
replays their command descriptor, exit code, output digest, duration, claims, and
Snapshot binding; it does not independently execute or attest the reported command.

`open_workbench` exchanges its one-time fragment token for an HttpOnly loopback
session cookie and serves the exact precompiled React Dashboard carried by the
installed CLI payload. From a Task Change Check, the installed-browser Alpha can
open the Finding's own Evidence and guarded Source range, focus a stable Graph
node associated with that Source, continue into Wiki, and return to the original
Task/Finding context. A
repository refresh leaves an older browser session pinned to its original
Snapshot and shows a stale state instead of silently rebinding Source or overlays.

After `refresh_index` has published Graph, Wiki, Search, and Repo Pulse artifacts,
run the installed-package Doctor from any directory inside that Git worktree:

```sh
cd /absolute/path/to/worktree/or/subdirectory
understand-code doctor
```

The zero-option Doctor checks Node.js 22+, Git, current worktree binding, published
Artifact schemas, loopback port availability, package/release metadata, bundled
executables, the current native tuple, and both self-contained Plugin payloads. It
prints one redacted JSON report and exits nonzero when a required check fails. The
report intentionally shows release authenticity and Provider-backed strong writes
as `locked`; those expected Alpha limitations do not make an otherwise intact
read-only/check installation unhealthy. Top-level `readiness: "alpha"`,
`releaseReady: false`, `strongWrites: "locked"`, and
`hostRegistration: "not_checked"` fields prevent an Alpha-healthy report from
being interpreted as a formal Release or as proof of Host registration.

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
or modified. The managed-copy lifecycle currently retains the earlier limited,
read-only embedded Workbench because it does not yet copy the React Dashboard
inventory through upgrade and rollback. That fallback is allowed only by an
explicit healthy installation manifest; a missing or invalid Dashboard beside a
global or Plugin CLI remains an error.

The Graph/Wiki process token remains a Preview-only, query-parameter, local
process-lifetime access token. In root mode it is bound to the clean repository
snapshot; demo mode serves only the embedded fixture. It is not the formal
Host Rendezvous token or a one-time security token.

Provider Authority, the execution fence, global rollback anchoring, and
production cross-platform hardening are not complete. Provider-backed strong
writes therefore remain locked. The bundled CLI may contain internal Provider
lifecycle candidates, but this Alpha does not claim that they are ready for
production use or that a live Provider execution path has been established.

The Alpha's UI evidence includes a same-tarball, monorepo-external real-browser
gate that drives the public MCP flow through Finding → Evidence/Source → Graph →
Wiki → Task and verifies Snapshot drift handling. This does **not** close the
formal Release, signed distribution, cross-platform, or full Host-mediated browser
gates.

## Preview commands

```text
understand-code-preview --demo [--port 0] [--no-open]
understand-code-preview --root <absolute-worktree> [--port 0] [--no-open]
understand-code-preview --help
understand-code-preview --version
```

The server binds to `127.0.0.1` only. Data endpoints require the printed token;
static HTML and JavaScript do not contain repository data.
