#!/usr/bin/env node
import { startPreview } from "./server.mjs";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installPackagedHost } from "./host-install.mjs";

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
if (typeof packageMetadata.version !== "string" || packageMetadata.version.length === 0) {
  throw new Error("Preview package version is unavailable");
}
const PRODUCT_VERSION = packageMetadata.version;

function help() {
  return [
    "Understand Code Preview Candidate",
    "",
    "Usage:",
    "  understand-code-preview --install-host codex|claude",
    "  understand-code-preview --demo [--port 0] [--no-open]",
    "  understand-code-preview --root <absolute-worktree> [--port 0] [--no-open]",
    "  understand-code-preview --help",
    "  understand-code-preview --version",
    "",
    "The default mode is --demo. The server is local and read-only.",
  ].join("\n");
}

function fail(message) {
  process.stderr.write(`preview_error ${message}\n`);
  process.exitCode = 2;
}

function parseArgs(values) {
  const args = { demo: false, root: null, port: 0, noOpen: false, help: false, version: false };
  if (values[0] === "--install-host") {
    if (values.length !== 2 || !["codex", "claude"].includes(values[1])) throw new Error("Choose --install-host codex or claude.");
    return { ...args, installHost: values[1] };
  }
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h") { args.help = true; continue; }
    if (value === "--version" || value === "-V") { args.version = true; continue; }
    if (value === "--demo") { if (args.root) throw new Error("--demo and --root are mutually exclusive"); args.demo = true; continue; }
    if (value === "--no-open") { args.noOpen = true; continue; }
    if (value === "--root") {
      const root = values[++index];
      if (!root || root.startsWith("--") || !path.isAbsolute(root)) throw new Error("--root must be an absolute path");
      if (args.demo) throw new Error("--demo and --root are mutually exclusive");
      args.root = root;
      continue;
    }
    if (value === "--port") {
      const port = Number(values[++index]);
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("--port must be an integer from 0 to 65535");
      args.port = port;
      continue;
    }
    throw new Error(`unknown option: ${value}`);
  }
  if (args.help || args.version) return args;
  if (!args.root) args.demo = true;
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(`${help()}\n`); }
  else if (args.version) { process.stdout.write(`${PRODUCT_VERSION}\n`); }
  else if (args.installHost) { process.stdout.write(`${installPackagedHost(args.installHost, path.dirname(fileURLToPath(import.meta.url)))}\n`); }
  else {
    const preview = await startPreview({ root: args.root, demo: args.demo, port: args.port });
    if (!args.noOpen) {
      const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
      const commandArgs = process.platform === "win32" ? ["/c", "start", "", preview.url] : [preview.url];
      const child = execFile(command, commandArgs, { windowsHide: true }, () => {});
      child.unref();
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

export { help, parseArgs };
