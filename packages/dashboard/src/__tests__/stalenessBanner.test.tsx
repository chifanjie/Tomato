import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StalenessBanner, { stalenessSummary } from "../components/StalenessBanner";

describe("stalenessSummary", () => {
  it("names the distance and the commit the graph was built from", () => {
    expect(stalenessSummary({
      graphCommit: "1bd770581e16db58e763216bfeff2db34dd29711",
      headCommit: "64504b950ff106c60fd9ca1b8aafa9249737d6fb",
      commitsBehind: 245,
      stale: true,
    })).toBe("图谱落后当前代码 245 个提交（基于 1bd7705）");
  });

  it("avoids inventing a distance when the old commit is unreachable", () => {
    expect(stalenessSummary({
      graphCommit: "1bd770581e16db58e763216bfeff2db34dd29711",
      headCommit: "64504b950ff106c60fd9ca1b8aafa9249737d6fb",
      commitsBehind: null,
      stale: true,
    })).toBe("图谱基于提交 1bd7705，与当前检出的代码不一致");
  });
});

describe("StalenessBanner", () => {
  it("renders nothing before meta.json has been read", () => {
    // A fresh or non-git checkout must not flash a warning.
    expect(renderToStaticMarkup(createElement(StalenessBanner, { accessToken: "t" }))).toBe("");
  });
});
