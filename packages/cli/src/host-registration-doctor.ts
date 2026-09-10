import { localRuntimeCapabilitiesV1 } from "./runtime/capabilities.js";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";

import { PRODUCT_VERSION } from "./constants.js";

export const HOST_REGISTRATION_DOCTOR_SCHEMA_VERSION =
  "understand-code-host-registration-doctor-v1" as const;

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const PLUGIN_ID = "understand-code@understand-code-alpha";
const PLUGIN_NAME = "understand-code";
const MARKETPLACE_NAME = "understand-code-alpha";

export type HostRegistrationDoctorHostV1 = "codex" | "claude";

export type HostRegistrationDoctorCheckIdV1 =
  | "host_cli"
  | "plugin_registration"
  | "plugin_version"
  | "plugin_enabled"
  | "plugin_mcp";

export type HostRegistrationDoctorCheckV1 = Readonly<{
  id: HostRegistrationDoctorCheckIdV1;
  status: "pass" | "fail" | "not_checked";
  code:
    | "ok"
    | "not_checked"
    | "host_cli_unavailable"
    | "host_cli_output_invalid"
    | "plugin_not_registered"
    | "plugin_registration_invalid"
    | "plugin_version_mismatch"
    | "plugin_disabled"
    | "plugin_mcp_missing"
    | "plugin_mcp_disabled"
    | "plugin_mcp_mismatch"
    | "plugin_mcp_unverifiable"
    | "orphan_mcp_registration";
  summary: string;
  observed?: string;
  required?: string;
  remediation?: string;
}>;

export type HostRegistrationDoctorResultV1 = Readonly<{
  schemaVersion: typeof HOST_REGISTRATION_DOCTOR_SCHEMA_VERSION;
  product: "understand-code";
  version: string;
  readiness: "alpha";
  releaseReady: false;
  strongWrites: "locked";
  capabilities: ReturnType<typeof localRuntimeCapabilitiesV1>;
  host: HostRegistrationDoctorHostV1;
  hostRegistration: "registered" | "not_registered" | "unknown";
  status: "healthy" | "not_registered" | "unhealthy" | "unavailable";
  ok: boolean;
  checks: readonly HostRegistrationDoctorCheckV1[];
}>;

/**
 * Optional values are a bounded test seam. Public argv never accepts an
 * executable, environment, timeout, cwd, command, or output parser override.
 */
export type HostRegistrationDoctorOptionsV1 = Readonly<{
  host: HostRegistrationDoctorHostV1;
  executable?: string;
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}>;

type ProbeFailureCode =
  | "host_cli_unavailable"
  | "host_cli_output_invalid";

class ProbeFailure extends Error {
  readonly code: ProbeFailureCode;

  constructor(code: ProbeFailureCode) {
    super(code);
    this.name = "ProbeFailure";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function equalStringArray(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function pass(
  id: HostRegistrationDoctorCheckIdV1,
  summary: string,
): HostRegistrationDoctorCheckV1 {
  return Object.freeze({ id, status: "pass", code: "ok", summary });
}

function fail(
  id: HostRegistrationDoctorCheckIdV1,
  code: Exclude<HostRegistrationDoctorCheckV1["code"], "ok" | "not_checked">,
  summary: string,
  remediation: string,
): HostRegistrationDoctorCheckV1 {
  return Object.freeze({
    id,
    status: "fail",
    code,
    summary,
    remediation,
  });
}

function notChecked(
  id: HostRegistrationDoctorCheckIdV1,
): HostRegistrationDoctorCheckV1 {
  return Object.freeze({
    id,
    status: "not_checked",
    code: "not_checked",
    summary: "This check was not run because a prerequisite was unavailable.",
  });
}

const ENVIRONMENT_KEYS = Object.freeze([
  "HOME",
  "USERPROFILE",
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "APPDATA",
  "LOCALAPPDATA",
  "XDG_CONFIG_HOME",
  "CODEX_HOME",
  "CLAUDE_CONFIG_DIR",
  "TEMP",
  "TMP",
  "TMPDIR",
] as const);

function cleanEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {
    LC_ALL: "C",
    LANG: "C",
    NO_COLOR: "1",
    TERM: "dumb",
    CI: "1",
  };
  for (const key of ENVIRONMENT_KEYS) {
    const value = source[key];
    if (
      typeof value === "string" &&
      value.length <= 32_768 &&
      !/[\u0000\r\n]/u.test(value)
    ) {
      clean[key] = value;
    }
  }
  return clean;
}

function timeout(value: number | undefined): number {
  return value === undefined ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAX_TIMEOUT_MS
    ? DEFAULT_TIMEOUT_MS
    : value;
}

function executable(value: string | undefined, host: HostRegistrationDoctorHostV1): string {
  if (value === undefined) return host;
  if (
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > 4_096 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new ProbeFailure("host_cli_unavailable");
  }
  return value;
}

function runJsonProbe(
  file: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      [...args],
      {
        cwd: tmpdir(),
        encoding: "utf8",
        env: environment,
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error !== null) {
          reject(new ProbeFailure("host_cli_unavailable"));
          return;
        }
        try {
          resolve(JSON.parse(stdout) as unknown);
        } catch {
          reject(new ProbeFailure("host_cli_output_invalid"));
        }
      },
    );
  });
}

function result(
  host: HostRegistrationDoctorHostV1,
  hostRegistration: HostRegistrationDoctorResultV1["hostRegistration"],
  status: HostRegistrationDoctorResultV1["status"],
  checks: readonly HostRegistrationDoctorCheckV1[],
): HostRegistrationDoctorResultV1 {
  return Object.freeze({
    schemaVersion: HOST_REGISTRATION_DOCTOR_SCHEMA_VERSION,
    product: "understand-code",
    version: PRODUCT_VERSION,
    readiness: "alpha",
    releaseReady: false,
    strongWrites: "locked",
    capabilities: localRuntimeCapabilitiesV1(),
    host,
    hostRegistration,
    status,
    ok: status === "healthy",
    checks: Object.freeze([...checks]),
  });
}

function unavailable(
  host: HostRegistrationDoctorHostV1,
  code: ProbeFailureCode,
): HostRegistrationDoctorResultV1 {
  return result(host, "unknown", "unavailable", [
    fail(
      "host_cli",
      code,
      "The selected Host CLI registration state could not be read safely.",
      "Install a supported Host CLI and retry its JSON registration probe.",
    ),
    notChecked("plugin_registration"),
    notChecked("plugin_version"),
    notChecked("plugin_enabled"),
    notChecked("plugin_mcp"),
  ]);
}

type PluginObservation = Readonly<{
  registration: "absent" | "invalid" | "valid";
  version?: unknown;
  enabled?: unknown;
  mcp?: unknown;
}>;

function codexPluginObservation(value: unknown): PluginObservation | undefined {
  if (
    !isRecord(value) ||
    !Array.isArray(value.installed) ||
    !Array.isArray(value.available) ||
    value.installed.some((entry) => !isRecord(entry))
  ) {
    return undefined;
  }
  const hints = value.installed.filter(
    (entry) =>
      isRecord(entry) &&
      (entry.pluginId === PLUGIN_ID ||
        entry.name === PLUGIN_NAME ||
        entry.marketplaceName === MARKETPLACE_NAME),
  );
  const targets = hints.filter(
    (entry) => isRecord(entry) && entry.pluginId === PLUGIN_ID,
  );
  if (hints.length === 0) return { registration: "absent" };
  if (
    hints.length !== 1 ||
    targets.length !== 1 ||
    targets[0]!.name !== PLUGIN_NAME ||
    targets[0]!.marketplaceName !== MARKETPLACE_NAME ||
    targets[0]!.installed !== true ||
    typeof targets[0]!.version !== "string" ||
    typeof targets[0]!.enabled !== "boolean"
  ) {
    return { registration: "invalid" };
  }
  return {
    registration: "valid",
    version: targets[0]!.version,
    enabled: targets[0]!.enabled,
  };
}

function claudePluginObservation(value: unknown): PluginObservation | undefined {
  if (!Array.isArray(value) || value.some((entry) => !isRecord(entry))) {
    return undefined;
  }
  const hints = value.filter(
    (entry) =>
      isRecord(entry) &&
      (entry.id === PLUGIN_ID ||
        (typeof entry.id === "string" && entry.id.startsWith(`${PLUGIN_NAME}@`)) ||
        (isRecord(entry.mcpServers) && PLUGIN_NAME in entry.mcpServers)),
  );
  const targets = hints.filter(
    (entry) => isRecord(entry) && entry.id === PLUGIN_ID,
  );
  if (hints.length === 0) return { registration: "absent" };
  if (
    hints.length !== 1 ||
    targets.length !== 1 ||
    targets[0]!.scope !== "user" ||
    typeof targets[0]!.version !== "string" ||
    typeof targets[0]!.enabled !== "boolean"
  ) {
    return { registration: "invalid" };
  }
  return {
    registration: "valid",
    version: targets[0]!.version,
    enabled: targets[0]!.enabled,
    mcp: targets[0]!.mcpServers,
  };
}

function codexMcpTargets(value: unknown): readonly Record<string, unknown>[] | undefined {
  if (!Array.isArray(value) || value.some((entry) => !isRecord(entry))) {
    return undefined;
  }
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      isRecord(entry) && entry.name === PLUGIN_NAME,
  );
}

function validCodexMcp(value: Record<string, unknown>): boolean {
  if (!isRecord(value.transport)) return false;
  return (
    value.enabled === true &&
    value.transport.type === "stdio" &&
    value.transport.command === "./bin/understand-code-plugin.mjs" &&
    equalStringArray(value.transport.args, ["--host", "codex"])
  );
}

function validClaudeMcp(value: unknown): "missing" | "mismatch" | "valid" {
  if (!isRecord(value) || !(PLUGIN_NAME in value)) return "missing";
  if (Object.keys(value).length !== 1 || !isRecord(value[PLUGIN_NAME])) {
    return "mismatch";
  }
  const server = value[PLUGIN_NAME];
  return server.command === "${CLAUDE_PLUGIN_ROOT}/bin/understand-code-plugin.mjs" &&
    equalStringArray(server.args, ["--host", "claude"])
    ? "valid"
    : "mismatch";
}

function inspectRegistration(
  host: HostRegistrationDoctorHostV1,
  plugin: PluginObservation,
  codexMcp: readonly Record<string, unknown>[] | undefined,
): HostRegistrationDoctorResultV1 {
  const hostCheck = pass(
    "host_cli",
    "The selected Host CLI returned bounded JSON registration state.",
  );
  if (plugin.registration === "invalid") {
    return result(host, "unknown", "unhealthy", [
      hostCheck,
      fail(
        "plugin_registration",
        "plugin_registration_invalid",
        "The Understand Code Plugin registration is ambiguous or invalid.",
        "Remove conflicting registrations and reinstall the bundled Plugin.",
      ),
      notChecked("plugin_version"),
      notChecked("plugin_enabled"),
      notChecked("plugin_mcp"),
    ]);
  }
  if (plugin.registration === "absent") {
    const orphan = host === "codex" && (codexMcp?.length ?? 0) > 0;
    return result(
      host,
      "not_registered",
      orphan ? "unhealthy" : "not_registered",
      [
        hostCheck,
        fail(
          "plugin_registration",
          "plugin_not_registered",
          "The Understand Code Plugin is not registered in the selected Host.",
          "Install understand-code@understand-code-alpha and retry Doctor.",
        ),
        notChecked("plugin_version"),
        notChecked("plugin_enabled"),
        orphan
          ? fail(
              "plugin_mcp",
              "orphan_mcp_registration",
              "An Understand Code MCP registration remains without its Plugin.",
              "Remove the orphan MCP registration before reinstalling the Plugin.",
            )
          : notChecked("plugin_mcp"),
      ],
    );
  }

  const versionCheck =
    plugin.version === PRODUCT_VERSION
      ? pass("plugin_version", "The registered Plugin matches this package version.")
      : fail(
          "plugin_version",
          "plugin_version_mismatch",
          "The registered Plugin version differs from this package version.",
          "Reinstall the Plugin from this package's bundled marketplace.",
        );
  const enabledCheck =
    plugin.enabled === true
      ? pass("plugin_enabled", "The registered Plugin is enabled.")
      : fail(
          "plugin_enabled",
          "plugin_disabled",
          "The registered Plugin is disabled.",
          "Enable the Plugin in the selected Host and retry Doctor.",
        );
  let mcpCheck: HostRegistrationDoctorCheckV1;
  if (host === "codex") {
    if (codexMcp === undefined || codexMcp.length > 1) {
      mcpCheck = fail(
        "plugin_mcp",
        "plugin_mcp_mismatch",
        "The Plugin MCP registration is ambiguous or invalid.",
        "Remove conflicting MCP state and reinstall the bundled Plugin.",
      );
    } else if (codexMcp.length === 0) {
      mcpCheck = fail(
        "plugin_mcp",
        "plugin_mcp_missing",
        "The Plugin MCP registration is missing.",
        "Reinstall the bundled Plugin and restart the selected Host.",
      );
    } else if (codexMcp[0]!.enabled !== true) {
      mcpCheck = fail(
        "plugin_mcp",
        "plugin_mcp_disabled",
        "The Plugin MCP registration is disabled.",
        "Enable the Plugin MCP registration and retry Doctor.",
      );
    } else {
      mcpCheck = validCodexMcp(codexMcp[0]!)
        ? pass("plugin_mcp", "The Plugin MCP registration matches the bundled profile.")
        : fail(
            "plugin_mcp",
            "plugin_mcp_mismatch",
            "The Plugin MCP registration differs from the bundled profile.",
            "Reinstall the bundled Plugin and restart the selected Host.",
          );
    }
  } else {
    const state = validClaudeMcp(plugin.mcp);
    mcpCheck =
      state === "valid"
        ? pass("plugin_mcp", "The Plugin MCP registration matches the bundled profile.")
        : fail(
            "plugin_mcp",
            state === "missing" ? "plugin_mcp_missing" : "plugin_mcp_mismatch",
            state === "missing"
              ? "The Plugin MCP registration is missing."
              : "The Plugin MCP registration differs from the bundled profile.",
            "Reinstall the bundled Plugin and restart the selected Host.",
          );
  }
  const checks = [
    hostCheck,
    pass(
      "plugin_registration",
      "The selected Host reports one canonical Understand Code Plugin registration.",
    ),
    versionCheck,
    enabledCheck,
    mcpCheck,
  ] as const;
  const healthy = checks.every((check) => check.status === "pass");
  return result(host, "registered", healthy ? "healthy" : "unhealthy", checks);
}

function unavailableCodexMcp(
  host: "codex",
  plugin: PluginObservation,
  code: ProbeFailureCode,
): HostRegistrationDoctorResultV1 {
  const cliCheck = fail(
    "host_cli",
    code,
    "A required Host CLI JSON registration probe could not be read safely.",
    "Verify the Host CLI installation and retry Doctor.",
  );
  const mcpCheck = fail(
    "plugin_mcp",
    "plugin_mcp_unverifiable",
    "The Plugin MCP registration could not be verified.",
    "Verify the Host CLI MCP command and retry Doctor.",
  );
  if (plugin.registration === "invalid") {
    return result(host, "unknown", "unavailable", [
      cliCheck,
      fail(
        "plugin_registration",
        "plugin_registration_invalid",
        "The Understand Code Plugin registration is ambiguous or invalid.",
        "Remove conflicting registrations and reinstall the bundled Plugin.",
      ),
      notChecked("plugin_version"),
      notChecked("plugin_enabled"),
      mcpCheck,
    ]);
  }
  if (plugin.registration === "absent") {
    return result(host, "not_registered", "unavailable", [
      cliCheck,
      fail(
        "plugin_registration",
        "plugin_not_registered",
        "The Understand Code Plugin is not registered in the selected Host.",
        "Install understand-code@understand-code-alpha and retry Doctor.",
      ),
      notChecked("plugin_version"),
      notChecked("plugin_enabled"),
      mcpCheck,
    ]);
  }
  return result(host, "registered", "unavailable", [
    cliCheck,
    pass(
      "plugin_registration",
      "The selected Host reports one canonical Understand Code Plugin registration.",
    ),
    plugin.version === PRODUCT_VERSION
      ? pass("plugin_version", "The registered Plugin matches this package version.")
      : fail(
          "plugin_version",
          "plugin_version_mismatch",
          "The registered Plugin version differs from this package version.",
          "Reinstall the Plugin from this package's bundled marketplace.",
        ),
    plugin.enabled === true
      ? pass("plugin_enabled", "The registered Plugin is enabled.")
      : fail(
          "plugin_enabled",
          "plugin_disabled",
          "The registered Plugin is disabled.",
          "Enable the Plugin in the selected Host and retry Doctor.",
        ),
    mcpCheck,
  ]);
}

/** Inspect one Host's current Plugin registration without changing Host state. */
export async function runHostRegistrationDoctorV1(
  options: HostRegistrationDoctorOptionsV1,
): Promise<HostRegistrationDoctorResultV1> {
  const host = options.host;
  let file: string;
  try {
    file = executable(options.executable, host);
  } catch (error) {
    return unavailable(
      host,
      error instanceof ProbeFailure ? error.code : "host_cli_unavailable",
    );
  }
  const environment = cleanEnvironment(options.environment ?? process.env);
  const timeoutMs = timeout(options.timeoutMs);
  try {
    if (host === "codex") {
      const pluginValue = await runJsonProbe(
        file,
        ["plugin", "list", "--json"],
        environment,
        timeoutMs,
      );
      const plugin = codexPluginObservation(pluginValue);
      if (plugin === undefined) {
        return unavailable(host, "host_cli_output_invalid");
      }
      let mcpValue: unknown;
      try {
        mcpValue = await runJsonProbe(
          file,
          ["mcp", "list", "--json"],
          environment,
          timeoutMs,
        );
      } catch (error) {
        return unavailableCodexMcp(
          host,
          plugin,
          error instanceof ProbeFailure ? error.code : "host_cli_unavailable",
        );
      }
      const mcp = codexMcpTargets(mcpValue);
      if (mcp === undefined) {
        return unavailableCodexMcp(host, plugin, "host_cli_output_invalid");
      }
      return inspectRegistration(host, plugin, mcp);
    }
    const pluginValue = await runJsonProbe(
      file,
      ["plugin", "list", "--json"],
      environment,
      timeoutMs,
    );
    const plugin = claudePluginObservation(pluginValue);
    return plugin === undefined
      ? unavailable(host, "host_cli_output_invalid")
      : inspectRegistration(host, plugin, undefined);
  } catch (error) {
    return unavailable(
      host,
      error instanceof ProbeFailure ? error.code : "host_cli_unavailable",
    );
  }
}
