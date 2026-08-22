#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MAX_ROOT_BYTES = 4_096;
const HOSTS = new Set(["codex", "claude"]);

function sanitizeEnvironment(environment) {
  const sanitized = {};
  for (const [name, value] of Object.entries(environment)) {
    if (name.toUpperCase().startsWith("GIT_")) continue;
    sanitized[name] = value;
  }
  sanitized.GIT_OPTIONAL_LOCKS = "0";
  sanitized.GIT_TERMINAL_PROMPT = "0";
  sanitized.LC_ALL = "C";
  return sanitized;
}

function parseHost(values) {
  if (values.length !== 2 || values[0] !== "--host" || !HOSTS.has(values[1])) {
    throw new TypeError("host_required");
  }
  return values[1];
}

function validateRoot(root, environment = process.env) {
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
  let canonicalRoot;
  let gitTopLevel;
  try {
    canonicalRoot = realpathSync(root);
    gitTopLevel = execFileSync(
      "git",
      ["-C", canonicalRoot, "rev-parse", "--show-toplevel"],
      {
        encoding: "utf8",
        env: sanitizeEnvironment(environment),
        maxBuffer: 8 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5_000,
      },
    ).trim();
    if (
      gitTopLevel.length === 0 ||
      Buffer.byteLength(gitTopLevel, "utf8") > MAX_ROOT_BYTES ||
      /[\u0000-\u001f\u007f]/u.test(gitTopLevel) ||
      !path.isAbsolute(gitTopLevel)
    ) {
      throw new TypeError("workspace_root_required");
    }
    gitTopLevel = realpathSync(gitTopLevel);
  } catch {
    return root;
  }
  return gitTopLevel;
}

function selectRoot(host, { env = process.env, cwd = process.cwd() } = {}) {
  if (host === "claude") {
    const projectRoot = env.CLAUDE_PROJECT_DIR;
    if (projectRoot === undefined || projectRoot === "") return undefined;
    return validateRoot(projectRoot, env);
  }
  if (host === "codex") {
    return validateRoot(cwd, env);
  }
  throw new TypeError("host_required");
}

function signalExitCode(signal) {
  if (signal === "SIGINT") return 130;
  if (signal === "SIGTERM") return 143;
  return 129;
}

async function run() {
  let root;
  const childEnvironment = sanitizeEnvironment(process.env);
  try {
    const host = parseHost(process.argv.slice(2));
    root = selectRoot(host, { env: childEnvironment });
  } catch {
    process.stderr.write("workspace_root_required\n");
    process.exitCode = 2;
    return;
  }

  const cliPath = fileURLToPath(new URL("./understand-code.mjs", import.meta.url));
  let child;
  try {
    const childArguments = [cliPath, "mcp", "--stdio"];
    if (root !== undefined) childArguments.push("--root", root);
    child = spawn(
      process.execPath,
      childArguments,
      {
        env: childEnvironment,
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

export { parseHost, sanitizeEnvironment, selectRoot, validateRoot };
