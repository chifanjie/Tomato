import { MAX_PATH_BYTES } from "./constants.js";

export type PreviewCliInvocationV1 =
  | { readonly kind: "help" }
  | { readonly kind: "version" }
  | {
      readonly kind: "mcp";
      readonly rootCandidates: readonly string[];
    };

export class PreviewCliArgumentErrorV1 extends Error {
  constructor() {
    super("Invalid Preview CLI arguments.");
    this.name = "PreviewCliArgumentErrorV1";
  }
}

function safePathArgumentV1(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Buffer.byteLength(value, "utf8") <= MAX_PATH_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

/**
 * Frozen Preview command surface: help, version, and the read-only three-tool
 * stdio MCP slice. Provider and installation lifecycle commands deliberately
 * do not enter this parser or its bundle graph.
 */
export function parsePreviewCliArgumentsV1(
  values: readonly string[],
): PreviewCliInvocationV1 {
  if (
    values.length === 0 ||
    (values.length === 1 && ["--help", "-h"].includes(values[0]!))
  ) {
    return { kind: "help" };
  }
  if (values.length === 1 && ["--version", "-V"].includes(values[0]!)) {
    return { kind: "version" };
  }
  if (values[0] !== "mcp") throw new PreviewCliArgumentErrorV1();

  let stdio = false;
  const rootCandidates: string[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const flag = values[index];
    if (flag === "--stdio") {
      if (stdio) throw new PreviewCliArgumentErrorV1();
      stdio = true;
      continue;
    }
    if (flag === "--root") {
      const root = values[index + 1];
      if (!safePathArgumentV1(root) || root.startsWith("--")) {
        throw new PreviewCliArgumentErrorV1();
      }
      rootCandidates.push(root);
      index += 1;
      continue;
    }
    throw new PreviewCliArgumentErrorV1();
  }
  if (!stdio) throw new PreviewCliArgumentErrorV1();
  return { kind: "mcp", rootCandidates: Object.freeze(rootCandidates) };
}

export function previewHelpTextV1(): string {
  return [
    "Understand Code Preview",
    "",
    "Usage:",
    "  understand-code mcp --stdio --root <absolute-worktree-path>",
    "  understand-code --help",
    "  understand-code --version",
    "",
  ].join("\n");
}
