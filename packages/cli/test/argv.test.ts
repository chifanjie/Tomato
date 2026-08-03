import { describe, expect, it } from "vitest";

import { CliArgumentError, parseCliArguments } from "../src/argv.js";

describe("CLI arguments", () => {
  it("accepts the self-contained stdio invocation", () => {
    expect(
      parseCliArguments(["mcp", "--stdio", "--root", "/tmp/repository"]),
    ).toEqual({ kind: "mcp", rootCandidates: ["/tmp/repository"] });
  });

  it("keeps an omitted root as a protocol-visible binding error", () => {
    expect(parseCliArguments(["mcp", "--stdio"])).toEqual({
      kind: "mcp",
      rootCandidates: [],
    });
  });

  it("retains repeated root candidates for fail-closed conflict handling", () => {
    expect(
      parseCliArguments([
        "mcp",
        "--stdio",
        "--root",
        "/tmp/one",
        "--root",
        "/tmp/two",
      ]),
    ).toEqual({
      kind: "mcp",
      rootCandidates: ["/tmp/one", "/tmp/two"],
    });
  });

  it.each([
    ["unknown command", ["serve"]],
    ["missing stdio", ["mcp", "--root", "/tmp/repository"]],
    ["duplicate stdio", ["mcp", "--stdio", "--stdio"]],
    ["unknown flag", ["mcp", "--stdio", "--token", "secret"]],
    ["missing root value", ["mcp", "--stdio", "--root"]],
    ["equals form", ["mcp", "--stdio", "--root=/tmp/repository"]],
  ])("rejects %s", (_name, values) => {
    expect(() => parseCliArguments(values)).toThrow(CliArgumentError);
  });
});
