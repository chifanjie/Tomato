import { describe, expect, it } from "vitest";

import {
  parsePreviewCliArgumentsV1,
  PreviewCliArgumentErrorV1,
  previewHelpTextV1,
} from "../src/preview-argv.js";

describe("Preview CLI arguments", () => {
  it("accepts only help, version, and the stdio MCP invocation", () => {
    expect(parsePreviewCliArgumentsV1([])).toEqual({ kind: "help" });
    expect(parsePreviewCliArgumentsV1(["--version"])).toEqual({
      kind: "version",
    });
    expect(
      parsePreviewCliArgumentsV1([
        "mcp",
        "--stdio",
        "--root",
        "/tmp/repository",
      ]),
    ).toEqual({ kind: "mcp", rootCandidates: ["/tmp/repository"] });
  });

  it.each([
    ["install", ["install"]],
    ["doctor", ["doctor"]],
    ["uninstall", ["uninstall"]],
    ["private service runtime", ["--service-config", "/tmp/service.json"]],
    ["private provider runtime", ["__provider-runtime"]],
    ["missing stdio", ["mcp", "--root", "/tmp/repository"]],
    ["unknown flag", ["mcp", "--stdio", "--token", "secret"]],
  ])("rejects %s", (_label, values) => {
    expect(() => parsePreviewCliArgumentsV1(values)).toThrow(
      PreviewCliArgumentErrorV1,
    );
  });

  it("publishes no lifecycle or Provider commands in help", () => {
    const help = previewHelpTextV1();
    expect(help).toContain("understand-code mcp --stdio --root");
    expect(help).not.toMatch(
      /(?:install|upgrade|rollback|doctor|uninstall|provider|service-config)/iu,
    );
  });
});
