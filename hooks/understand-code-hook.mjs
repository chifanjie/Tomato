#!/usr/bin/env node
// Decides whether an understand-code hook should ask the agent to refresh the
// knowledge graph. Prints a prompt on stdout when it should, prints nothing
// otherwise, and always exits 0 so a broken workspace never blocks the host.
//
// Modes:
//   session-start  graph exists but was built against a different commit
//   post-tool-use  a commit-like Bash command just ran
//
// Replaces the previous inline `grep '"autoUpdate".*true'` test, which also
// matched `{"autoUpdate": false, "somethingElse": true}`.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const STATE_DIR = ".understand-code";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function autoUpdateEnabled() {
  const config = readJson(join(STATE_DIR, "config.json"));
  return config?.autoUpdate === true;
}

function graphExists() {
  try {
    readFileSync(join(STATE_DIR, "knowledge-graph.json"));
    return true;
  } catch {
    return false;
  }
}

function headCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

// Global git flags that may sit between `git` and the subcommand. `-c` and `-C`
// consume the following token, so they must be matched before the bare `-\w`
// alternative or `git -C /repo commit` looks like `git /repo`.
const GIT_GLOBAL_FLAG = String.raw`(?:-[cC]\s+\S+|--(?:git-dir|work-tree|namespace|exec-path)(?:=\S+|\s+\S+)|--\S+|-\w)`;
const HISTORY_COMMAND = new RegExp(
  String.raw`\bgit\s+(?:${GIT_GLOBAL_FLAG}\s+)*(?:commit|merge|cherry-pick|rebase|revert)\b`,
);

/** True when the tool input looks like a command that creates new history. */
function isCommitCommand(toolInput) {
  return HISTORY_COMMAND.test(toolInput);
}

function graphIsStale() {
  const meta = readJson(join(STATE_DIR, "meta.json"));
  const recorded = meta?.gitCommitHash;
  const head = headCommit();
  // Only claim staleness when both sides are known and actually differ.
  if (typeof recorded !== "string" || !recorded || !head) return false;
  return recorded !== head;
}

function prompt(reason) {
  const root = process.env.CLAUDE_PLUGIN_ROOT ?? ".";
  return (
    `[understand-code] ${reason} You MUST read the file at ` +
    `${join(root, "hooks", "auto-update-prompt.md")} and execute its instructions ` +
    `to incrementally update the knowledge graph. Do not ask the user for ` +
    `confirmation — just do it.`
  );
}

function main() {
  const mode = process.argv[2];
  if (!autoUpdateEnabled() || !graphExists()) return;

  if (mode === "session-start") {
    if (graphIsStale()) {
      process.stdout.write(
        prompt("The knowledge graph was built against a different commit.") + "\n",
      );
    }
    return;
  }

  if (mode === "post-tool-use") {
    const toolInput = process.env.TOOL_INPUT ?? "";
    if (isCommitCommand(toolInput)) {
      process.stdout.write(
        prompt("A commit was detected and auto-update is enabled.") + "\n",
      );
    }
  }
}

try {
  main();
} catch {
  // A hook must never fail the host session.
}
