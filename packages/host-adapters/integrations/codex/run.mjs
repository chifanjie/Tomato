#!/usr/bin/env node

import { spawn } from "node:child_process";

import {
  buildMcpArgv,
  HostAdapterArgumentError,
  parseHostAdapterArguments,
  resolveCliCommand,
} from "../../dist/index.js";

function fail(code) {
  process.stderr.write(`${code}\n`);
  process.exitCode = code === "workspace_root_required" ? 2 : 1;
}

let root;
try {
  root = parseHostAdapterArguments(process.argv.slice(2)).root;
} catch (error) {
  if (error instanceof HostAdapterArgumentError) {
    fail("workspace_root_required");
    process.exit();
  }
  fail("host_adapter_error");
  process.exit();
}

let child;
try {
  child = spawn(resolveCliCommand(), buildMcpArgv(root), {
    env: process.env,
    shell: false,
    stdio: "inherit",
  });
} catch {
  fail("host_adapter_unavailable");
  process.exit();
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.once("error", () => {
  fail("host_adapter_unavailable");
});
child.once("exit", (code, signal) => {
  if (signal !== null) {
    process.exitCode = 128 + (signal === "SIGINT" ? 2 : signal === "SIGTERM" ? 15 : 1);
  } else {
    process.exitCode = code ?? 1;
  }
});
