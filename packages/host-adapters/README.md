# Understand Code host adapters

This package contains the smallest installable bridge for Codex CLI and Claude
Code. Both adapters launch the same self-contained stdio MCP CLI; they do not
inspect Git, parse the repository graph, or implement task logic.

Each host must supply one explicit absolute workspace root:

```text
understand-code-codex --root /absolute/path/to/worktree
understand-code-claude --root /absolute/path/to/worktree
```

The bundled configs are templates. Replace `${WORKSPACE_ROOT}` for Codex, or
let Claude Code expand `${CLAUDE_PROJECT_DIR}`, before starting the wrapper.
An unresolved, missing, relative, or duplicate wrapper root is rejected with a
generic configuration error; the wrapper never falls back to its current
directory. `UNDERSTAND_CODE_CLI` may point at a development CLI executable,
otherwise the published `understand-code` binary is used.

The host-specific manifests carry the same placeholder as their config
(`${WORKSPACE_ROOT}` for Codex and `${CLAUDE_PROJECT_DIR}` for Claude), so
an installer can validate that it did not accidentally cross-wire the hosts.

Bundled files:

- `integrations/codex/config.toml` and `mcp.json`;
- `integrations/claude/.mcp.json`;
- one manifest and one Node wrapper for each host.

The wrapper forwards stdio and the exact argv
`mcp --stdio --root <absolute-worktree-path>` to the CLI.
