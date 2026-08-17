import { describe, expect, it } from "vitest";

import { CliArgumentError, parseCliArguments } from "../src/argv.js";

describe("CLI arguments", () => {
  it("accepts the self-contained stdio invocation", () => {
    expect(
      parseCliArguments(["mcp", "--stdio", "--root", "/tmp/repository"]),
    ).toEqual({ kind: "mcp", rootCandidates: ["/tmp/repository"] });
  });

  it("accepts only an absolute signed config for the private provider service", () => {
    expect(
      parseCliArguments([
        "--service-config",
        "/etc/understand-code/provider.json",
      ]),
    ).toEqual({
      kind: "provider_service_runtime",
      serviceConfig: "/etc/understand-code/provider.json",
    });
    expect(() =>
      parseCliArguments(["--service-config", "relative.json"]),
    ).toThrow(CliArgumentError);
  });

  it("accepts installation lifecycle commands with an explicit home", () => {
    expect(parseCliArguments(["install", "--home", "/tmp/understand-code"])).toEqual({
      kind: "installation",
      operation: "install",
      home: "/tmp/understand-code",
    });
    expect(parseCliArguments(["doctor"])).toEqual({
      kind: "installation",
      operation: "doctor",
    });
    expect(
      parseCliArguments([
        "doctor",
        "--provider",
        "--root",
        "/tmp/provider-target",
        "--service-config",
        "/etc/understand-code/provider.json",
        "--service-readiness",
        "/var/lib/understand-code/provider/ready.json",
      ]),
    ).toEqual({
      kind: "installation",
      operation: "doctor",
      root: "/tmp/provider-target",
      provider: true,
      serviceConfig: "/etc/understand-code/provider.json",
      serviceReadiness: "/var/lib/understand-code/provider/ready.json",
    });
    expect(parseCliArguments(["upgrade", "--root", "/tmp/understand-code"])).toEqual({
      kind: "installation",
      operation: "upgrade",
      root: "/tmp/understand-code",
    });
    expect(parseCliArguments(["install", "--host", "claude", "--home", "/tmp/understand-code"])).toEqual({
      kind: "installation",
      operation: "install",
      host: "claude",
      home: "/tmp/understand-code",
    });
    expect(
      parseCliArguments([
        "install",
        "--provider-service",
        "--root",
        "/var/lib/understand-code/provider",
        "--service-config",
        "/etc/understand-code/provider.json",
        "--service-key",
        "/etc/understand-code/provider.key",
        "--service-descriptor",
        "/etc/systemd/system/understand-code-provider.service",
      ]),
    ).toEqual({
      kind: "installation",
      operation: "install",
      providerService: true,
      root: "/var/lib/understand-code/provider",
      serviceConfig: "/etc/understand-code/provider.json",
      serviceKey: "/etc/understand-code/provider.key",
      serviceDescriptor: "/etc/systemd/system/understand-code-provider.service",
    });
    expect(parseCliArguments(["rollback"])).toEqual({
      kind: "installation",
      operation: "rollback",
    });
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
    ["relative install home", ["install", "--home", "relative"]],
    ["duplicate install home", ["doctor", "--home", "/tmp/a", "--home", "/tmp/b"]],
    ["invalid install host", ["install", "--host", "unknown"]],
    ["host on doctor", ["doctor", "--host", "codex"]],
    ["provider on install", ["install", "--provider"]],
    ["provider service on doctor", ["doctor", "--provider-service"]],
    ["provider service without config", ["install", "--provider-service", "--root", "/tmp/a", "--service-key", "/tmp/key"]],
    ["provider service without key", ["install", "--provider-service", "--root", "/tmp/a", "--service-config", "/tmp/config"]],
    ["provider service with home alias", ["install", "--provider-service", "--home", "/tmp/a", "--service-config", "/tmp/config", "--service-key", "/tmp/key"]],
    ["provider service readiness", ["install", "--provider-service", "--root", "/tmp/a", "--service-config", "/tmp/config", "--service-key", "/tmp/key", "--service-readiness", "/tmp/ready"]],
    ["provider service relative root", ["install", "--provider-service", "--root", "relative", "--service-config", "/tmp/config", "--service-key", "/tmp/key"]],
    ["provider without target", ["doctor", "--provider"]],
    ["provider with home alias", ["doctor", "--provider", "--home", "/tmp/a"]],
    ["duplicate provider", ["doctor", "--provider", "--provider"]],
    ["service config without readiness", ["doctor", "--provider", "--root", "/tmp/a", "--service-config", "/tmp/config"]],
    ["service readiness without config", ["doctor", "--provider", "--root", "/tmp/a", "--service-readiness", "/tmp/ready"]],
    ["service flags without provider", ["doctor", "--root", "/tmp/a", "--service-config", "/tmp/config", "--service-readiness", "/tmp/ready"]],
    ["relative service config", ["doctor", "--provider", "--root", "/tmp/a", "--service-config", "relative", "--service-readiness", "/tmp/ready"]],
  ])("rejects %s", (_name, values) => {
    expect(() => parseCliArguments(values)).toThrow(CliArgumentError);
  });
});
