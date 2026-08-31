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
command, or the original tarball location.

## Packaged Host lifecycle

The commands below use visibly invalid absolute placeholders so an unexpanded
shell variable cannot silently select another package. Run `npm root -g`, then
replace every `/ABSOLUTE/NPM/GLOBAL/ROOT` occurrence with that command's exact
absolute output. Replace the tarball and repository placeholders before running
any command. After every npm install below, `understand-code --version` must
print the intended tarball's exact package version before any Host command is
run. Keep the old tarball if pinned recovery may be needed.

### 1. First install, Doctor, and a new Host session

```sh
npm install -g "/ABSOLUTE/PATH/TO/understand-code-preview-X.Y.Z.tgz"
understand-code --version

codex plugin marketplace add "/ABSOLUTE/NPM/GLOBAL/ROOT/@understand-code/preview/dist/plugin-roots/codex" --json
codex plugin add understand-code@understand-code-alpha --json

claude plugin validate --strict "/ABSOLUTE/NPM/GLOBAL/ROOT/@understand-code/preview/dist/plugin-roots/claude"
claude plugin marketplace add "/ABSOLUTE/NPM/GLOBAL/ROOT/@understand-code/preview/dist/plugin-roots/claude" --scope user
claude plugin install understand-code@understand-code-alpha --scope user

understand-code doctor --host codex
understand-code doctor --host claude
```

The Codex marketplace JSON must report
`marketplaceName: "understand-code-alpha"`; the plugin JSON must report the
canonical `pluginId`, exact `version`, and active `installedPath`. Both Doctor
commands must exit 0 and report
`hostRegistration: "registered"`, `status: "healthy"`, the installed package
version, `strongWrites: "locked"`, and `releaseReady: false`. Close any Host
session that was open during installation. Start a new Codex or Claude session
inside `/ABSOLUTE/PATH/TO/GIT/WORKTREE`; for Claude, the Host must supply that
same canonical worktree as `CLAUDE_PROJECT_DIR`. A new session is the supported
boundary for loading the newly cached plugin and its MCP tools.

### 2. Install a newer packaged plugin

Install the new tarball at the same global npm location first:

```sh
npm install -g "/ABSOLUTE/PATH/TO/understand-code-preview-NEW-VERSION.tgz"
understand-code --version
```

For Codex, reinstall from the already configured marketplace:

```sh
codex plugin add understand-code@understand-code-alpha --json
understand-code doctor --host codex
```

This is an official `plugin add` cache replacement/reinstall flow. It is not an
atomic plugin upgrade and `codex plugin marketplace upgrade` only refreshes a
Git-backed marketplace; it is not the packaged local update command. Doctor
must exit 0 with the new exact version before starting a new Codex session.

For Claude, refresh the configured marketplace and use the Host's update
command:

```sh
claude plugin marketplace update understand-code-alpha
claude plugin update understand-code@understand-code-alpha --scope user
understand-code doctor --host claude
```

Claude reports that a restart is required. Close the old session; Doctor must
exit 0 with the new exact version before a new Claude session starts.

### 3. Recover a retained pinned package

Reinstall the retained old tarball so the configured local marketplaces again
expose its exact payload:

```sh
npm install -g "/ABSOLUTE/PATH/TO/understand-code-preview-PINNED-VERSION.tgz"
understand-code --version
```

For Codex, remove the active cached version and add the pinned payload again:

```sh
codex plugin remove understand-code@understand-code-alpha --json
codex plugin add understand-code@understand-code-alpha --json
understand-code doctor --host codex
```

For Claude, clear the active registration, refresh the local marketplace, and
install the pinned payload:

```sh
claude plugin uninstall understand-code@understand-code-alpha --scope user --yes
claude plugin list --json
claude plugin marketplace update understand-code-alpha
claude plugin install understand-code@understand-code-alpha --scope user
understand-code doctor --host claude
```

The intermediate Claude list must contain no
`understand-code@understand-code-alpha` entry before reinstall; leave unrelated
plugins untouched. These are official reinstall recovery procedures, not an
atomic downgrade or rollback. Each Doctor must exit 0 with the pinned exact
version. Start a new Host session in the original Git worktree. Ask the Host to
call `get_task_brief` with the exact persisted Task ID recorded before the version
change. Recovery is successful only when the returned Task ID, revision,
baseline Snapshot, and current Snapshot remain the expected persisted values;
do not substitute a newly created Task as proof of recovery.

### 4. Remove Host registration

Remove the Codex registration and its configured marketplace, then verify that
only the target plugin entry is absent. Preserve every unrelated plugin:

```sh
codex plugin remove understand-code@understand-code-alpha --json
codex plugin marketplace remove understand-code-alpha
codex plugin list --json
```

Remove the Claude registration and marketplace separately, again preserving
unrelated plugins:

```sh
claude plugin uninstall understand-code@understand-code-alpha --scope user --yes
claude plugin marketplace remove understand-code-alpha --scope user
claude plugin list --json
```

Finally, run both expected-nonzero Doctor checks. These POSIX assertions keep
the documented exit status 1 from triggering `set -e`; an argv error exit
status 2 still fails. Also inspect the required JSON state described below:

```sh
doctor_status=0
understand-code doctor --host codex || doctor_status=$?
test "$doctor_status" -eq 1

doctor_status=0
understand-code doctor --host claude || doctor_status=$?
test "$doctor_status" -eq 1
```

After removal, each Doctor intentionally exits with process status 1 and reports
`hostRegistration: "not_registered"`; this is expected and must not be bypassed
as a successful healthy check. Codex removal must remove the exact active
`installedPath` reported by the most recent `plugin add`. For Claude,
`plugin list --json` is the authority for active registration and must no
longer contain `understand-code@understand-code-alpha`. The Codex list must also
contain no target entry; unrelated Codex and Claude plugins must remain intact.
Claude may retain an inert version cache after uninstall; do not treat that
inactive cache as a registered plugin, never execute it directly, and do not
delete unrelated Host cache content manually.

Host Registration Doctor only reads the selected Host CLI's bounded JSON Plugin
state. A healthy result means the current Host reports the canonical Plugin,
matching package version, enabled state, and bundled MCP profile. It does not
establish publisher authenticity, Provider authority, or an execution fence;
`strongWrites` remains locked.

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
`UNDERSTAND_CODE_CLI` override. When a Provider-backed strong Store is installed,
Codex and Claude can resume the same persisted Task even when their working
directories differ. This unsigned Alpha keeps that Store locked; legacy Task
resume therefore fails closed with `provider_unavailable`. Missing, relative, or
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
The public read-only Pulse and refresh surfaces remain available; Task, Change
Check, Verification, Evidence, Search, Impact, and Workbench operations require
the accepted Provider-backed strong Store. Until that gate is installed, the
legacy routes return the redacted `provider_unavailable` failure before reading
private Task/Pulse state. Source changes remain external: Understand Code records
and checks a change, but does not edit repository source files or unlock strong
writes.
Verification records are externally reported evidence. The Alpha persists and
replays their command descriptor, exit code, output digest, duration, claims, and
Snapshot binding; it does not independently execute or attest the reported command.

Both installed Host wrappers expose the same Task workflow guidance through MCP
`initialize.instructions`. For a Provider-authorized Task, checked knowledge is
first saved with `refresh_index` / `knowledge.action=stage`; the returned
candidate remains read-only and is not current Task evidence. Only after the
actual verification and the Provider-backed Task transition to `verified` may
`knowledge.action=publish` use that candidate ID, its source Snapshot and the
current Task revision. These instructions do not unlock the Alpha or authorize
extra tool calls. Candidate discovery/preview HTTP is implemented, but its UI
review controls are not yet connected; stage success is not a completed review.

`open_workbench` is present in the public contract but remains Provider-gated in
this Alpha. Without an accepted strong Store it returns `provider_unavailable`,
and the Preview Task endpoints return the same redacted 503 before reading any
legacy Task, Change Check, Verification, or private Pulse payload. The
same-tarball browser gate verifies this fail-closed state, absence of canary data,
and clean process shutdown. The successful Finding → Evidence/Source → Graph →
Wiki → Task interaction is reserved for the post-gate Workbench slice; it is not
claimed by this locked Alpha.

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
or modified. A release-managed installation copies the exact version-bound React
Dashboard inventory beside its owned CLI; upgrade, rollback, Doctor, and uninstall
track that inventory as part of the same installation manifest. Older managed
installations may retain the limited read-only embedded Workbench only when an
explicit healthy legacy manifest permits it. A missing or invalid Dashboard beside
a global or Plugin CLI remains an error.

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
gate that drives the locked Task surface, proves `provider_unavailable` is
redacted, checks legacy/strong canaries do not leak, and verifies clean process
shutdown. It does **not** claim a successful Finding → Evidence/Source → Graph →
Wiki → Task interaction until the Provider projection gate is closed. It also
does not close the formal Release, signed distribution, cross-platform, or Gold
gates. The officially active Claude cache has been shown to keep its bundled MCP
alive while the browser gate runs, but this is not yet a credentialed,
model-selected tool call from a complete Codex or Claude chat.

## Assemble an unsigned Alpha Candidate

From an exact clean Git checkout with the committed `pnpm-lock.yaml`, install
only the locked dependencies and assemble into a new absolute directory outside
the checkout:

```sh
pnpm install --frozen-lockfile
node packages/preview/scripts/alpha-candidate.mjs assemble --output /ABSOLUTE/NEW/understand-code-alpha-candidate
node packages/preview/scripts/alpha-candidate.mjs verify --candidate /ABSOLUTE/NEW/understand-code-alpha-candidate
```

`assemble` refuses an existing output directory. `verify` requires that exact
directory to contain four regular files and nothing else:

- one `understand-code-preview-*.tgz` npm package;
- `understand-code-alpha-candidate.json`;
- `understand-code-alpha-candidate-v1.schema.json` copied byte-for-byte from
  the reviewed source schema; and
- `SHA256SUMS`, which binds the other three files.

Both successful commands print one JSON object with
`disposition: "unsigned_alpha_candidate"` and `releaseReady: false`. The
candidate manifest binds the clean Git commit/tree and committed lockfile, the
tgz SHA-256 and size, package identity, embedded release-manifest digest, native
tuple, and the successful cold-package/checksum gates. Re-run `verify` after
copying or transporting the directory. It rejects missing, additional, or
schema-invalid files and byte changes that are inconsistent with the recorded
hashes. Because the metadata is unsigned, a coordinated rewrite of the
artifacts together with recomputed unsigned metadata and checksums is not
detectable or authenticated by `verify`.

`verify` is source-aware rather than a self-contained check of the candidate
directory. Run it from a checkout whose Git object format matches the candidate,
whose object database still retains the recorded commit, tree, and committed
lockfile blob, and whose reviewed `understand-code-alpha-candidate-v1` schema
bytes are unchanged. The checkout's current `HEAD` may be newer and may have a
different tree or lockfile; verification continues to resolve the exact
recorded objects.
Copying only the four candidate files, pruning those Git objects, or changing
the reviewed schema does not provide a portable historical verification path.
This mechanism is not a history-retention policy, an anti-rollback control, or
independent provenance/authenticity proof.

This output is a local, unsigned Alpha Candidate only. It is not an RC or formal
Release, has no signature, SBOM, or trusted provenance, and evaluates only the
current platform/native tuple. It does not establish cross-platform readiness,
publisher authenticity, Provider Authority, an execution fence, or unlocked
strong writes. Keep those limitations visible; do not rename or present this
directory as a signed or release-ready distribution.

## Preview commands

```text
understand-code-preview --demo [--port 0] [--no-open]
understand-code-preview --root <absolute-worktree> [--port 0] [--no-open]
understand-code-preview --help
understand-code-preview --version
```

The server binds to `127.0.0.1` only. Data endpoints require the printed token;
static HTML and JavaScript do not contain repository data.
