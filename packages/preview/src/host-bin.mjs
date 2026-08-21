#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MAX_ROOT_BYTES = 4_096;

function parseRoot(values) {
  if (values.length !== 2 || values[0] !== "--root") {
    throw new TypeError("workspace_root_required");
  }
  const root = values[1];
  if (
    typeof root !== "string" ||
    root.length === 0 ||
    Buffer.byteLength(root, "utf8") > MAX_ROOT_BYTES ||
    /[\u0000-\u001f\u007f]/u.test(root) ||
    root.startsWith("--") ||
    root.includes("${") ||
    !path.isAbsolute(root)
  ) {
    throw new TypeError("workspace_root_required");
  }
  return root;
}

function signalExitCode(signal) {
  if (signal === "SIGINT") return 130;
  if (signal === "SIGTERM") return 143;
  return 129;
}

async function run() {
  let root;
  try {
    root = parseRoot(process.argv.slice(2));
  } catch {
    process.stderr.write("workspace_root_required\n");
    process.exitCode = 2;
    return;
  }

  const cliPath = fileURLToPath(new URL("./understand-code.mjs", import.meta.url));
  let child;
  try {
    child = spawn(
      process.execPath,
      [cliPath, "mcp", "--stdio", "--root", root],
      {
        env: process.env,
        shell: false,
        stdio: "inherit",
      },
    );
  } catch {
    process.stderr.write("host_adapter_unavailable\n");
    process.exitCode = 1;
    return;
  }

  const signalHandlers = new Map();
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    const handler = () => {
      if (!child.killed) child.kill(signal);
    };
    signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }

  const outcome = await new Promise((resolve) => {
    child.once("error", () => resolve({ error: true }));
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  for (const [signal, handler] of signalHandlers) {
    process.off(signal, handler);
  }
  if (outcome.error === true) {
    process.stderr.write("host_adapter_unavailable\n");
    process.exitCode = 1;
  } else if (outcome.signal !== null) {
    process.exitCode = signalExitCode(outcome.signal);
  } else {
    process.exitCode = outcome.code ?? 1;
  }
}

await run();

export { parseRoot };
