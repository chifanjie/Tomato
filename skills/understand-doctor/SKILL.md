---
name: understand-doctor
description: Diagnose an Understand Code installation — plugin root, build state, graph and knowledge-base freshness — and report exactly what to run next. Use when a /understand command fails, when the dashboard shows no graph or no knowledge base, or when the user asks whether the plugin is installed correctly.
argument-hint: "[project-path]"
---

# /understand-doctor

Report the health of the Understand Code installation and of this project's
generated artifacts, then name the exact next command. Read-only: this skill
never regenerates the graph or the knowledge base on its own.

## Instructions

1. Resolve `PROJECT_ROOT`.
   - If `$ARGUMENTS` contains a non-flag path, resolve it against the current
     working directory and verify it is a directory.
   - Otherwise use the current working directory.

2. Run the diagnostic script. It prints a human-readable report and exits 0 when
   everything is healthy, 1 when something needs attention.

   ```bash
   # Locate the shared resolver, then let it validate and print the plugin root.
   # The resolution order and diagnostics live in scripts/resolve-plugin-root.sh.
   PLUGIN_ROOT=""
   for base in "${CLAUDE_PLUGIN_ROOT:-}" \
     "$HOME/.understand-code-plugin" \
     "$(realpath "$HOME/.agents/skills/understand-doctor/../.." 2>/dev/null)" \
     "$(realpath "$HOME/.copilot/skills/understand-doctor/../.." 2>/dev/null)" \
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

   node "$PLUGIN_ROOT/scripts/understand-doctor.mjs" "$PROJECT_ROOT"
   ```

   If the resolver itself fails, the plugin is not installed where this host can
   see it. Report the resolver's own diagnostic and stop — no other check is
   meaningful until the root resolves.

3. Relay the report to the user as-is, then state the single most useful next
   command from the script's `下一步` section. Do not run that command unless the
   user asks for it.

## What the report covers

| Check | Why it matters |
| --- | --- |
| Plugin root and host binding | Every other skill resolves scripts from here. |
| Node and pnpm versions | Node ≥ 22 and pnpm ≥ 10 are required to build `core`. |
| `packages/core/dist` build state | Graph and knowledge-base scripts import it. |
| `knowledge-graph.json` presence and size | The dashboard and all query skills read it. |
| Graph freshness vs `git HEAD` | A stale graph describes code that has changed. |
| Knowledge-base format (`wiki-index.json`) | The dashboard reads V2; older layouts render as "尚未生成知识库". |
| Knowledge base vs graph commit | A wiki built from an older graph contradicts the graph. |
