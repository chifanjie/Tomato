import { MAX_PATH_BYTES } from "./constants.js";

export type CliInvocation =
  | { readonly kind: "help" }
  | { readonly kind: "version" }
  | {
      readonly kind: "installation";
      readonly operation: "install" | "upgrade" | "rollback" | "doctor" | "uninstall";
      readonly root?: string;
      readonly home?: string;
    }
  | {
      readonly kind: "mcp";
      readonly rootCandidates: readonly string[];
    };

export class CliArgumentError extends Error {
  constructor() {
    super("Invalid CLI arguments.");
    this.name = "CliArgumentError";
  }
}

function safePathArgument(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Buffer.byteLength(value, "utf8") <= MAX_PATH_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

export function parseCliArguments(values: readonly string[]): CliInvocation {
  if (values.length === 0 || (values.length === 1 && ["--help", "-h"].includes(values[0]!))) {
    return { kind: "help" };
  }
  if (values.length === 1 && ["--version", "-V"].includes(values[0]!)) {
    return { kind: "version" };
  }
  if (["install", "upgrade", "rollback", "doctor", "uninstall"].includes(values[0] ?? "")) {
    const operation = values[0] as
      | "install"
      | "upgrade"
      | "rollback"
      | "doctor"
      | "uninstall";
    let root: string | undefined;
    let home: string | undefined;
    for (let index = 1; index < values.length; index += 1) {
      const flag = values[index];
      if (flag !== "--root" && flag !== "--home") throw new CliArgumentError();
      const target = values[index + 1];
      if (!safePathArgument(target) || !pathIsAbsolute(target)) {
        throw new CliArgumentError();
      }
      if (flag === "--root") {
        if (root !== undefined) throw new CliArgumentError();
        root = target;
      } else {
        if (home !== undefined) throw new CliArgumentError();
        home = target;
      }
      index += 1;
    }
    return {
      kind: "installation",
      operation,
      ...(root === undefined ? {} : { root }),
      ...(home === undefined ? {} : { home }),
    };
  }
  if (values[0] !== "mcp") throw new CliArgumentError();

  let stdio = false;
  const rootCandidates: string[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const flag = values[index];
    if (flag === "--stdio") {
      if (stdio) throw new CliArgumentError();
      stdio = true;
      continue;
    }
    if (flag === "--root") {
      const root = values[index + 1];
      if (!safePathArgument(root) || root.startsWith("--")) {
        throw new CliArgumentError();
      }
      rootCandidates.push(root);
      index += 1;
      continue;
    }
    throw new CliArgumentError();
  }
  if (!stdio) throw new CliArgumentError();
  return { kind: "mcp", rootCandidates: Object.freeze(rootCandidates) };
}

function pathIsAbsolute(value: string): boolean {
  // Keep argv parsing platform-neutral when the bundled CLI is exercised from
  // a different host than the build machine.
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value);
}

export function helpText(): string {
  return [
    "Understand Code",
    "",
    "Usage:",
    "  understand-code mcp --stdio --root <absolute-worktree-path>",
    "  understand-code install [--root <absolute-install-root>|--home <absolute-install-home>]",
    "  understand-code upgrade [--root <absolute-install-root>|--home <absolute-install-home>]",
    "  understand-code rollback [--root <absolute-install-root>|--home <absolute-install-home>]",
    "  understand-code doctor [--root <absolute-install-root>|--home <absolute-install-home>]",
    "  understand-code uninstall [--root <absolute-install-root>|--home <absolute-install-home>]",
    "  understand-code --help",
    "  understand-code --version",
    "",
  ].join("\n");
}
