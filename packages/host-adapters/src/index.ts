import path from "node:path";

/** The two host surfaces intentionally share one MCP command contract. */
export type HostAdapterId = "codex" | "claude";

export const HOST_ADAPTER_SCHEMA_VERSION = "understand-code-host-adapter-v1" as const;
export const MCP_SERVER_NAME = "understand-code" as const;
export const CODEX_ROOT_PLACEHOLDER = "${WORKSPACE_ROOT}" as const;
export const CLAUDE_ROOT_PLACEHOLDER = "${CLAUDE_PROJECT_DIR}" as const;
/** Generic placeholder used by the cross-host contract and Codex template. */
export const ROOT_PLACEHOLDER = CODEX_ROOT_PLACEHOLDER;
export const ROOT_FLAG = "--root" as const;

export type HostRootPlaceholder =
  | typeof CODEX_ROOT_PLACEHOLDER
  | typeof CLAUDE_ROOT_PLACEHOLDER;

export interface HostAdapterManifestV1 {
  readonly schemaVersion: typeof HOST_ADAPTER_SCHEMA_VERSION;
  readonly host: HostAdapterId;
  readonly name: typeof MCP_SERVER_NAME;
  readonly transport: "stdio";
  readonly wrapper: string;
  readonly cliCommand: "understand-code";
  readonly cliArgs: readonly ["mcp", "--stdio", "--root", HostRootPlaceholder];
  readonly root: {
    readonly required: true;
    readonly flag: typeof ROOT_FLAG;
    readonly placeholder: HostRootPlaceholder;
    readonly absolute: true;
  };
}

export interface HostMcpServerConfigV1 {
  readonly mcpServers: {
    readonly "understand-code": {
      readonly command: string;
      readonly args: readonly ["--root", string];
      readonly env?: Readonly<Record<string, string>>;
    };
  };
}

/**
 * The command names are intentionally fixed to the bundled host entrypoints.
 * Installers may still choose a different command when they build a private
 * config, but the default projection always points at the published adapter
 * for the selected host.
 */
export const HOST_ADAPTER_COMMANDS: Readonly<Record<HostAdapterId, string>> =
  Object.freeze({
    codex: "understand-code-codex",
    claude: "understand-code-claude",
  });

function hostPlaceholder(host: HostAdapterId): HostRootPlaceholder {
  return host === "claude" ? CLAUDE_ROOT_PLACEHOLDER : CODEX_ROOT_PLACEHOLDER;
}

/** Build the exact MCP server projection consumed by a host config file. */
export function buildHostMcpServerConfigV1(
  host: HostAdapterId,
  command = HOST_ADAPTER_COMMANDS[host],
): HostMcpServerConfigV1 {
  if (!isHostAdapterId(host) || !safeText(command)) {
    throw new HostAdapterArgumentError("Invalid host adapter configuration.");
  }
  return Object.freeze({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command,
        args: [ROOT_FLAG, hostPlaceholder(host)] as const,
      },
    },
  }) as HostMcpServerConfigV1;
}

/**
 * Validate an MCP projection before it is persisted by an installer.  The
 * check is deliberately exact: a host cannot silently receive the other
 * host's root placeholder or an extra command argument.
 */
export function isHostMcpServerConfigV1(
  value: unknown,
  host: HostAdapterId,
  expectedCommand = HOST_ADAPTER_COMMANDS[host],
): value is HostMcpServerConfigV1 {
  if (!isHostAdapterId(host) || !safeText(expectedCommand)) return false;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const servers = (value as Record<string, unknown>).mcpServers;
  if (servers === null || typeof servers !== "object" || Array.isArray(servers)) return false;
  const server = (servers as Record<string, unknown>)[MCP_SERVER_NAME];
  if (server === null || typeof server !== "object" || Array.isArray(server)) return false;
  const candidate = server as Record<string, unknown>;
  const args = candidate.args;
  return (
    candidate.command === expectedCommand &&
    Array.isArray(args) &&
    args.length === 2 &&
    args[0] === ROOT_FLAG &&
    args[1] === hostPlaceholder(host)
  );
}

export function isHostAdapterId(value: unknown): value is HostAdapterId {
  return value === "codex" || value === "claude";
}

export class HostAdapterArgumentError extends Error {
  constructor(message = "A workspace root is required.") {
    super(message);
    this.name = "HostAdapterArgumentError";
  }
}

const MAX_ROOT_BYTES = 4_096;

function safeText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= MAX_ROOT_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

/**
 * Parse the tiny wrapper contract.  The wrapper deliberately accepts no
 * repository, Git, graph, or task options; those remain owned by the MCP CLI.
 */
export function parseHostAdapterArguments(
  values: readonly string[],
): { readonly root: string } {
  if (values.length !== 2 || values[0] !== ROOT_FLAG) {
    throw new HostAdapterArgumentError();
  }
  const root = values[1];
  if (
    !safeText(root) ||
    root.startsWith("--") ||
    root.includes("${") ||
    !path.isAbsolute(root)
  ) {
    throw new HostAdapterArgumentError();
  }
  return { root };
}

/** Exact argv handed to the already-installed self-contained CLI. */
export function buildMcpArgv(root: string): readonly string[] {
  return Object.freeze(["mcp", "--stdio", "--root", parseHostAdapterArguments([ROOT_FLAG, root]).root]);
}

/**
 * Resolve a command without invoking a shell.  Hosts may override this for a
 * development checkout; production defaults to the published `understand-code`
 * executable.  Command strings containing control characters are rejected.
 */
export function resolveCliCommand(environment: Readonly<Record<string, string | undefined>> = process.env): string {
  const candidate = environment.UNDERSTAND_CODE_CLI;
  if (candidate === undefined || candidate === "") return "understand-code";
  if (!safeText(candidate)) throw new HostAdapterArgumentError();
  return candidate;
}

export const CODEX_MANIFEST_V1: HostAdapterManifestV1 = Object.freeze({
  schemaVersion: HOST_ADAPTER_SCHEMA_VERSION,
  host: "codex",
  name: MCP_SERVER_NAME,
  transport: "stdio",
  wrapper: "integrations/codex/run.mjs",
  cliCommand: "understand-code",
  cliArgs: ["mcp", "--stdio", "--root", ROOT_PLACEHOLDER] as const,
  root: {
    required: true,
    flag: ROOT_FLAG,
    placeholder: ROOT_PLACEHOLDER,
    absolute: true,
  } as const,
});

export const CLAUDE_MANIFEST_V1: HostAdapterManifestV1 = Object.freeze({
  schemaVersion: HOST_ADAPTER_SCHEMA_VERSION,
  host: "claude",
  name: MCP_SERVER_NAME,
  transport: "stdio",
  wrapper: "integrations/claude/run.mjs",
  cliCommand: "understand-code",
  cliArgs: ["mcp", "--stdio", "--root", CLAUDE_ROOT_PLACEHOLDER] as const,
  root: {
    required: true,
    flag: ROOT_FLAG,
    placeholder: CLAUDE_ROOT_PLACEHOLDER,
    absolute: true,
  } as const,
});

export const HOST_ADAPTER_MANIFESTS: Readonly<Record<HostAdapterId, HostAdapterManifestV1>> =
  Object.freeze({ codex: CODEX_MANIFEST_V1, claude: CLAUDE_MANIFEST_V1 });

/** Structural check used by focused tests and installers before copying config. */
export function isHostAdapterManifestV1(value: unknown): value is HostAdapterManifestV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const root = candidate.root;
  const cliArgs = candidate.cliArgs;
  return (
    candidate.schemaVersion === HOST_ADAPTER_SCHEMA_VERSION &&
    (candidate.host === "codex" || candidate.host === "claude") &&
    candidate.name === MCP_SERVER_NAME &&
    candidate.transport === "stdio" &&
    typeof candidate.wrapper === "string" &&
    candidate.cliCommand === "understand-code" &&
    Array.isArray(cliArgs) &&
    cliArgs.length === 4 &&
    cliArgs[0] === "mcp" &&
    cliArgs[1] === "--stdio" &&
    cliArgs[2] === "--root" &&
    cliArgs[3] ===
      (candidate.host === "claude"
        ? CLAUDE_ROOT_PLACEHOLDER
        : CODEX_ROOT_PLACEHOLDER) &&
    root !== null &&
    typeof root === "object" &&
    !Array.isArray(root) &&
    (root as Record<string, unknown>).required === true &&
    (root as Record<string, unknown>).flag === ROOT_FLAG &&
    (root as Record<string, unknown>).placeholder ===
      (candidate.host === "claude"
        ? CLAUDE_ROOT_PLACEHOLDER
        : CODEX_ROOT_PLACEHOLDER) &&
    (root as Record<string, unknown>).absolute === true
  );
}
