import { describe, expect, it } from "vitest";

import { computeGraphStaleness, type GitRunner } from "../../graphStaleness";

const HEAD = "b".repeat(40);
const OLD = "a".repeat(40);

function git(responses: Record<string, string | null>): GitRunner {
  return (args) => responses[args.join(" ")] ?? null;
}

describe("computeGraphStaleness", () => {
  it("reports a fresh graph when the commits match", () => {
    const result = computeGraphStaleness(
      { gitCommitHash: HEAD },
      "/repo",
      git({ "rev-parse HEAD": HEAD }),
    );

    expect(result).toEqual({
      graphCommit: HEAD, headCommit: HEAD, commitsBehind: 0, stale: false,
    });
  });

  it("reports the distance when the graph is behind HEAD", () => {
    const result = computeGraphStaleness(
      { gitCommitHash: OLD },
      "/repo",
      git({ "rev-parse HEAD": HEAD, [`rev-list --count ${OLD}..${HEAD}`]: "245" }),
    );

    expect(result.stale).toBe(true);
    expect(result.commitsBehind).toBe(245);
  });

  it("stays stale with an unknown distance when the old commit is gone", () => {
    const result = computeGraphStaleness(
      { gitCommitHash: OLD },
      "/repo",
      git({ "rev-parse HEAD": HEAD }),
    );

    expect(result.stale).toBe(true);
    expect(result.commitsBehind).toBeNull();
  });

  it("never claims staleness outside a git worktree", () => {
    const result = computeGraphStaleness({ gitCommitHash: OLD }, "/repo", git({}));

    expect(result).toEqual({
      graphCommit: OLD, headCommit: null, commitsBehind: null, stale: false,
    });
  });

  it("never claims staleness when meta.json records no commit", () => {
    const result = computeGraphStaleness({}, "/repo", git({ "rev-parse HEAD": HEAD }));

    expect(result.stale).toBe(false);
    expect(result.graphCommit).toBeNull();
  });

  it("rejects a malformed recorded commit", () => {
    const result = computeGraphStaleness(
      { gitCommitHash: "not-a-sha" },
      "/repo",
      git({ "rev-parse HEAD": HEAD }),
    );

    expect(result.graphCommit).toBeNull();
    expect(result.stale).toBe(false);
  });
});
