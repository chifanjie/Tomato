---
name: understand-dashboard
description: Launch the interactive web dashboard to visualize a codebase's knowledge graph
argument-hint: [project-path]
---

# /understand-dashboard

Start the Understand Code dashboard to visualize the knowledge graph for the current project.

## Instructions

1. Determine the project directory:
   - If `$ARGUMENTS` contains a path, use that as the project directory
   - Otherwise, use the current working directory

2. Check that `.understand-code/knowledge-graph.json` exists in the project directory. If not, tell the user:
   ```
   No knowledge graph found. Run /understand first to analyze this project.
   ```

3. Find the dashboard code. The dashboard is at `packages/dashboard/` relative to this plugin's root directory. Check these paths in order and use the first that exists:
   - `${CLAUDE_PLUGIN_ROOT}/packages/dashboard/` (Claude Code runtime root, highest priority)
   - `~/.understand-code-plugin/packages/dashboard/` (universal symlink, all installs)
   - Two levels up from `~/.agents/skills/understand-dashboard` real path (self-relative fallback)
   - Two levels up from `~/.copilot/skills/understand-dashboard` real path (Copilot personal skills fallback)
   - Common clone-based install roots:
     - `~/.codex/understand-code/understand-code-plugin/packages/dashboard/`
     - `~/.opencode/understand-code/understand-code-plugin/packages/dashboard/`
     - `~/.pi/understand-code/understand-code-plugin/packages/dashboard/`
     - `~/understand-code/understand-code-plugin/packages/dashboard/`

   Use the Bash tool to resolve:
   ```bash
   # Locate the shared resolver, then let it validate and print the plugin root.
   # The resolution order and diagnostics live in scripts/resolve-plugin-root.sh.
   PLUGIN_ROOT=""
   for base in "${CLAUDE_PLUGIN_ROOT:-}" \
     "$HOME/.understand-code-plugin" \
     "$(realpath "$HOME/.agents/skills/understand-dashboard/../.." 2>/dev/null)" \
     "$(realpath "$HOME/.copilot/skills/understand-dashboard/../.." 2>/dev/null)" \
     "$HOME/.codex/understand-code/understand-code-plugin" \
     "$HOME/.opencode/understand-code/understand-code-plugin" \
     "$HOME/.pi/understand-code/understand-code-plugin" \
     "$HOME/understand-code/understand-code-plugin"; do
     if [ -n "$base" ] && [ -f "$base/scripts/resolve-plugin-root.sh" ]; then
       PLUGIN_ROOT=$(bash "$base/scripts/resolve-plugin-root.sh") || exit 1
       break
     fi
   done
   
   if [ -z "$PLUGIN_ROOT" ]; then
     echo "Error: Cannot find the understand-code plugin root." >&2
     echo "Set CLAUDE_PLUGIN_ROOT, or reinstall the plugin for your host." >&2
     exit 1
   fi

   # The dashboard needs its own package, which a skills-only install may omit.
   DASHBOARD_DIR="$PLUGIN_ROOT/packages/dashboard"
   if [ ! -d "$DASHBOARD_DIR" ]; then
     echo "Error: $DASHBOARD_DIR is missing from this install." >&2
     echo "Install the full plugin (not skills only) to use the dashboard." >&2
     exit 1
   fi
   ```

4. Install dependencies and build if needed. `DASHBOARD_DIR` and `PLUGIN_ROOT`
   are already set by step 3 — use them literally, do not substitute paths by hand:
   ```bash
   cd "$DASHBOARD_DIR" && (pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
   ```
   Then ensure the core package is built (the dashboard depends on it):
   ```bash
   cd "$PLUGIN_ROOT" && pnpm --filter @understand-code/core build
   ```

5. Start the Vite dev server pointing at the project's knowledge graph. Set
   `PROJECT_DIR` to the project directory resolved in step 1:
   ```bash
   cd "$DASHBOARD_DIR" && GRAPH_DIR="$PROJECT_DIR" npx vite --host 127.0.0.1
   ```
   Run this in the background so the user can continue working.

6. **Capture the access token URL from the server output.** The Vite server prints a line like:
   ```
   🔑  Dashboard URL: http://127.0.0.1:<PORT>?token=<TOKEN>
   ```
   Extract the full URL including the `?token=` parameter. The token is required to access the knowledge graph data — without it the dashboard will show an "Access Token Required" gate.

7. Report to the user, including the full tokenized URL:
   ```
   Dashboard started at http://127.0.0.1:<PORT>?token=<TOKEN>
   Viewing: <project-dir>/.understand-code/knowledge-graph.json

   The dashboard is running in the background. Press Ctrl+C in the terminal to stop it.
   ```
   **Important:** Always include the `?token=` parameter in the URL you share. If you omit it, the user will be blocked by the token gate and have to manually find the token in the terminal output.

## Notes

- Vite is configured to open the tokenized URL in the default browser on start
- If port 5173 is already in use, Vite will pick the next available port
- The `GRAPH_DIR` environment variable tells the dashboard where to find the knowledge graph
