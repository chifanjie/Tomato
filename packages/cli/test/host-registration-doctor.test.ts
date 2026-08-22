import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PRODUCT_VERSION } from "../src/constants.js";
import {
  HOST_REGISTRATION_DOCTOR_SCHEMA_VERSION,
  runHostRegistrationDoctorV1,
  type HostRegistrationDoctorHostV1,
  type HostRegistrationDoctorResultV1,
} from "../src/host-registration-doctor.js";
import {
  cleanupTemporaryDirectories,
  createTemporaryDirectory,
} from "./helpers.js";

const checkIds = [
  "host_cli",
  "plugin_registration",
  "plugin_version",
  "plugin_enabled",
  "plugin_mcp",
] as const;

type FakeResponse =
  | Readonly<{ readonly json: unknown }>
  | Readonly<{ readonly hang: true }>
  | Readonly<{ readonly stdout: string; readonly exitCode?: number }>;

afterEach(cleanupTemporaryDirectories);

async function createFakeHostCli(
  responses: Readonly<Record<string, FakeResponse>>,
): Promise<{ readonly executable: string; readonly root: string }> {
  const root = await createTemporaryDirectory("understand-code-host-doctor-");
  const script = path.join(root, "fake-host.mjs");
  const encoded = Buffer.from(JSON.stringify(responses), "utf8").toString("base64");
  await writeFile(
    script,
    `#!/usr/bin/env node
const responses = JSON.parse(Buffer.from(${JSON.stringify(encoded)}, "base64").toString("utf8"));
const key = process.argv.slice(2).join(" ");
const response = responses[key];
if (response === undefined) process.exit(23);
if (response.hang === true) {
  setInterval(() => {}, 1_000);
} else {
  process.stdout.write("json" in response ? JSON.stringify(response.json) : response.stdout);
  if (response.exitCode !== undefined) process.exitCode = response.exitCode;
}
`,
    "utf8",
  );
  if (process.platform === "win32") {
    const executable = path.join(root, "fake-host.cmd");
    await writeFile(
      executable,
      `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`,
      "utf8",
    );
    return { executable, root };
  }
  await chmod(script, 0o755);
  return { executable: script, root };
}

function codexResponses(
  pluginList: unknown,
  mcpList: unknown,
): Readonly<Record<string, FakeResponse>> {
  return {
    "plugin list --json": { json: pluginList },
    "mcp list --json": { json: mcpList },
  };
}

function claudeResponses(pluginList: unknown): Readonly<Record<string, FakeResponse>> {
  return { "plugin list --json": { json: pluginList } };
}

function healthyPlugin(host: HostRegistrationDoctorHostV1, privateValue: string): unknown {
  if (host === "codex") {
    return {
      installed: [
        {
          pluginId: "understand-code@understand-code-alpha",
          name: "understand-code",
          marketplaceName: "understand-code-alpha",
          installed: true,
          enabled: true,
          version: PRODUCT_VERSION,
          installPath: privateValue,
          source: privateValue,
        },
      ],
      available: [],
    };
  }
  return [
    {
      id: "understand-code@understand-code-alpha",
      version: PRODUCT_VERSION,
      scope: "user",
      enabled: true,
      installPath: privateValue,
      mcpServers: {
        "understand-code": {
          command: "${CLAUDE_PLUGIN_ROOT}/bin/understand-code-plugin.mjs",
          args: ["--host", "claude"],
        },
      },
    },
  ];
}

function healthyCodexMcp(privateValue: string): unknown {
  return [
    {
      name: "understand-code",
      enabled: true,
      source: privateValue,
      transport: {
        type: "stdio",
        command: "./bin/understand-code-plugin.mjs",
        args: ["--host", "codex"],
      },
    },
  ];
}

function expectSafeEnvelope(
  result: HostRegistrationDoctorResultV1,
  host: HostRegistrationDoctorHostV1,
): void {
  expect(result).toMatchObject({
    schemaVersion: HOST_REGISTRATION_DOCTOR_SCHEMA_VERSION,
    product: "understand-code",
    version: PRODUCT_VERSION,
    readiness: "alpha",
    releaseReady: false,
    strongWrites: "locked",
    host,
  });
  expect(result.checks.map(({ id }) => id)).toEqual(checkIds);
}

describe("Host Registration Doctor", () => {
  it.each(["codex", "claude"] as const)(
    "reports one exact enabled %s Plugin and MCP registration as healthy",
    async (host) => {
      const privateValue = `/private/${host}/installation/secret-token`;
      const responses =
        host === "codex"
          ? codexResponses(healthyPlugin(host, privateValue), healthyCodexMcp(privateValue))
          : claudeResponses(healthyPlugin(host, privateValue));
      const fake = await createFakeHostCli(responses);

      const result = await runHostRegistrationDoctorV1({
        host,
        executable: fake.executable,
        environment: {
          PATH: process.env.PATH,
          HOME: path.join(fake.root, "private-home"),
        },
      });

      expectSafeEnvelope(result, host);
      expect(result).toMatchObject({
        hostRegistration: "registered",
        status: "healthy",
        ok: true,
      });
      expect(result.checks.every(({ status, code }) => status === "pass" && code === "ok")).toBe(true);
      const publicBytes = JSON.stringify(result);
      expect(publicBytes).not.toContain(privateValue);
      expect(publicBytes).not.toContain(fake.root);
    },
  );

  it("distinguishes a clean absence from an orphan Codex MCP registration", async () => {
    const absent = await createFakeHostCli(
      codexResponses({ installed: [], available: [] }, []),
    );
    const absentResult = await runHostRegistrationDoctorV1({
      host: "codex",
      executable: absent.executable,
      environment: { PATH: process.env.PATH },
    });
    expectSafeEnvelope(absentResult, "codex");
    expect(absentResult).toMatchObject({
      hostRegistration: "not_registered",
      status: "not_registered",
      ok: false,
    });
    expect(absentResult.checks.map(({ status, code }) => ({ status, code }))).toEqual([
      { status: "pass", code: "ok" },
      { status: "fail", code: "plugin_not_registered" },
      { status: "not_checked", code: "not_checked" },
      { status: "not_checked", code: "not_checked" },
      { status: "not_checked", code: "not_checked" },
    ]);

    const orphan = await createFakeHostCli(
      codexResponses({ installed: [], available: [] }, healthyCodexMcp("private-source")),
    );
    const orphanResult = await runHostRegistrationDoctorV1({
      host: "codex",
      executable: orphan.executable,
      environment: { PATH: process.env.PATH },
    });
    expect(orphanResult).toMatchObject({
      hostRegistration: "not_registered",
      status: "unhealthy",
      ok: false,
    });
    expect(orphanResult.checks.at(-1)).toMatchObject({
      id: "plugin_mcp",
      status: "fail",
      code: "orphan_mcp_registration",
    });
  });

  it("reports a version drift without losing the exact registered identity", async () => {
    const plugin = healthyPlugin("claude", "private-source") as Array<Record<string, unknown>>;
    plugin[0]!.version = `${PRODUCT_VERSION}-drift`;
    const fake = await createFakeHostCli(claudeResponses(plugin));

    const result = await runHostRegistrationDoctorV1({
      host: "claude",
      executable: fake.executable,
      environment: { PATH: process.env.PATH },
    });

    expectSafeEnvelope(result, "claude");
    expect(result).toMatchObject({
      hostRegistration: "registered",
      status: "unhealthy",
      ok: false,
    });
    expect(result.checks[2]).toMatchObject({
      id: "plugin_version",
      status: "fail",
      code: "plugin_version_mismatch",
    });
    expect(result.checks.filter(({ status }) => status === "pass")).toHaveLength(4);
  });

  it("bounds a timed-out Host probe and redacts executable and environment details", async () => {
    const fake = await createFakeHostCli({
      "plugin list --json": { hang: true },
      "mcp list --json": { hang: true },
    });
    const privateHome = path.join(fake.root, "home-with-secret");

    const result = await runHostRegistrationDoctorV1({
      host: "codex",
      executable: fake.executable,
      environment: { PATH: process.env.PATH, HOME: privateHome },
      timeoutMs: 25,
    });

    expectSafeEnvelope(result, "codex");
    expect(result).toMatchObject({
      hostRegistration: "unknown",
      status: "unavailable",
      ok: false,
    });
    expect(result.checks[0]).toMatchObject({
      id: "host_cli",
      status: "fail",
      code: "host_cli_unavailable",
    });
    expect(result.checks.slice(1).every(({ status }) => status === "not_checked")).toBe(true);
    const publicBytes = JSON.stringify(result);
    expect(publicBytes).not.toContain(fake.executable);
    expect(publicBytes).not.toContain(fake.root);
    expect(publicBytes).not.toContain(privateHome);
  });
});
