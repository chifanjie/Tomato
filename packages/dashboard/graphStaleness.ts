import { execFileSync } from "node:child_process";

/**
 * Whether the published graph still describes the checked-out commit.
 *
 * A graph is a snapshot. Nothing in the dashboard used to say how old that
 * snapshot was, so a graph built 245 commits ago rendered exactly like a fresh
 * one and every conclusion drawn from it looked current.
 */
export interface GraphStaleness {
  /** Commit the graph was built from, as recorded in meta.json. */
  readonly graphCommit: string | null;
  /** Commit currently checked out, or null outside a git worktree. */
  readonly headCommit: string | null;
  /** Commits on HEAD that the graph does not know about, when computable. */
  readonly commitsBehind: number | null;
  /** True only when both commits are known and they differ. */
  readonly stale: boolean;
}

export interface GitRunner {
  (args: readonly string[], cwd: string): string | null;
}

/** Runs git, returning trimmed stdout, or null for any failure. */
export const runGit: GitRunner = (args, cwd) => {
  try {
    return execFileSync("git", [...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const COMMIT = /^[0-9a-f]{40}$/;

export function computeGraphStaleness(
  meta: unknown,
  projectRoot: string,
  git: GitRunner = runGit,
): GraphStaleness {
  const recorded = (meta as { gitCommitHash?: unknown } | null)?.gitCommitHash;
  const graphCommit = typeof recorded === "string" && COMMIT.test(recorded) ? recorded : null;
  const head = git(["rev-parse", "HEAD"], projectRoot);
  const headCommit = typeof head === "string" && COMMIT.test(head) ? head : null;

  if (graphCommit === null || headCommit === null) {
    return { graphCommit, headCommit, commitsBehind: null, stale: false };
  }
  if (graphCommit === headCommit) {
    return { graphCommit, headCommit, commitsBehind: 0, stale: false };
  }

  // The recorded commit may be gone (rebased, pruned); treat that as unknown
  // distance rather than reporting a wrong number.
  const counted = git(["rev-list", "--count", `${graphCommit}..${headCommit}`], projectRoot);
  const commitsBehind = counted !== null && /^\d+$/.test(counted) ? Number(counted) : null;

  return { graphCommit, headCommit, commitsBehind, stale: true };
}
