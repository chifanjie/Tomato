#!/usr/bin/env bash
# Prints the absolute understand-code plugin root on stdout, or exits 1 with a
# diagnostic on stderr.
#
# Single source of truth for plugin-root resolution. Skills used to inline three
# slightly different copies of this loop, and `understand-full` referenced
# $PLUGIN_ROOT without ever resolving it.
#
# Resolution order:
#   1. $CLAUDE_PLUGIN_ROOT           — set by Claude Code for plugin skills
#   2. this script's own location    — works for any host that can run the file
#   3. known per-host install paths  — Codex / Copilot / opencode / pi / manual
#
# Usage: PLUGIN_ROOT=$(bash /path/to/resolve-plugin-root.sh) || exit 1

set -uo pipefail

# A directory is the plugin root when it carries the workspace manifest pair.
is_plugin_root() {
  [ -n "${1:-}" ] && [ -f "$1/package.json" ] && [ -f "$1/pnpm-workspace.yaml" ]
}

absolute() {
  [ -n "${1:-}" ] && [ -d "$1" ] && (cd "$1" 2>/dev/null && pwd -P)
}

# Resolve a host skill symlink back into the real checkout it points at.
from_skill_symlink() {
  local link real
  link="$1"
  real=$(realpath "$link" 2>/dev/null || readlink -f "$link" 2>/dev/null || echo "")
  [ -n "$real" ] && absolute "$real/../.."
}

self_root() {
  local source="${BASH_SOURCE[0]:-$0}"
  # Follow symlinks so a linked script still finds its real checkout.
  while [ -L "$source" ]; do
    local target
    target=$(readlink "$source")
    case "$target" in
      /*) source="$target" ;;
      *) source="$(dirname "$source")/$target" ;;
    esac
  done
  absolute "$(dirname "$source")/.."
}

CANDIDATES=(
  "${CLAUDE_PLUGIN_ROOT:-}"
  "$(self_root)"
  "$HOME/.understand-code-plugin"
  "$(from_skill_symlink "$HOME/.agents/skills/understand")"
  "$(from_skill_symlink "$HOME/.copilot/skills/understand")"
  "$HOME/.codex/understand-code/understand-code-plugin"
  "$HOME/.opencode/understand-code/understand-code-plugin"
  "$HOME/.pi/understand-code/understand-code-plugin"
  "$HOME/understand-code/understand-code-plugin"
)

for candidate in "${CANDIDATES[@]}"; do
  if is_plugin_root "$candidate"; then
    absolute "$candidate"
    exit 0
  fi
done

{
  echo "Error: Cannot find the understand-code plugin root."
  echo "A plugin root must contain both package.json and pnpm-workspace.yaml."
  echo "Checked:"
  for candidate in "${CANDIDATES[@]}"; do
    echo "  - ${candidate:-<unresolved>}"
  done
  echo "Make sure the plugin is installed correctly."
} >&2
exit 1
