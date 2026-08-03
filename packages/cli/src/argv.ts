import { MAX_PATH_BYTES } from "./constants.js";

export type CliInvocation =
  | { readonly kind: "help" }
  | { readonly kind: "version" }
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

export function helpText(): string {
  return [
    "Understand Code",
    "",
    "Usage:",
    "  understand-code mcp --stdio --root <absolute-worktree-path>",
    "  understand-code --help",
    "  understand-code --version",
    "",
  ].join("\n");
}
