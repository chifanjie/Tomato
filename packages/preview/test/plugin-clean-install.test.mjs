import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PROCESS_TIMEOUT_MS = 20_000;
const EXTERNAL_TIMEOUT_MS = 60_000;
const PLUGIN_NAME = "understand-code";
const MARKETPLACE_NAME = "understand-code-alpha";

function execBounded(command, args, options = {}) {
  return execFileAsync(command, args, {
    ...options,
    timeout: options.timeout ?? EXTERNAL_TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: 8 * 1024 * 1024,
  });
}

async function isExecutable(candidate) {
  if (!candidate) return false;
  try {
    await access(candidate, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findExecutable(explicit, candidates, name) {
  if (explicit !== undefined) {
    const resolved = path.resolve(explicit);
    assert.equal(await isExecutable(resolved), true, `${name} override must name an executable`);
    return resolved;
  }
  for (const candidate of candidates) {
    if (await isExecutable(candidate)) return await realpath(candidate);
  }
  try {
    const located = await execBounded("sh", ["-c", `command -v ${name}`], {
      encoding: "utf8",
      timeout: 5_000,
    });
    const resolved = located.stdout.trim();
    if (await isExecutable(resolved)) return await realpath(resolved);
  } catch {
    // The release gate can explicitly require Host CLIs; ordinary package CI may not carry them.
  }
  return null;
}

function cleanHostEnvironment(home, extra = {}) {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    TMPDIR: process.env.TMPDIR ?? tmpdir(),
    LANG: process.env.LANG ?? "C.UTF-8",
    HOME: home,
    USERPROFILE: home,
    USER: "understand-code-e2e",
    LOGNAME: "understand-code-e2e",
    XDG_CACHE_HOME: path.join(home, ".cache"),
    XDG_CONFIG_HOME: path.join(home, ".config"),
    XDG_DATA_HOME: path.join(home, ".local/share"),
    CI: "1",
    NO_COLOR: "1",
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    ...extra,
  };
}

function withTimeout(promise, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function waitForExit(child, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve([child.exitCode, child.signalCode]);
  }
  return withTimeout(new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve([code, signal]));
  }), label, timeoutMs);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (child.stdin?.writable) child.stdin.end();
  child.kill("SIGTERM");
  try {
    await waitForExit(child, "MCP graceful stop", 2_000);
  } catch {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await waitForExit(child, "MCP forced stop", 2_000);
  }
}

function writeMessage(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function collectMessages(child) {
  const messages = [];
  const stderr = [];
  const waiters = [];
  let terminalError = null;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  createInterface({ input: child.stdout }).on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      terminalError = new Error(`MCP emitted invalid JSON: ${line}`, { cause: error });
      for (const waiter of waiters.splice(0)) waiter.reject(terminalError);
      return;
    }
    messages.push(message);
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(message)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  });
  child.once("error", (error) => {
    terminalError = error;
    for (const waiter of waiters.splice(0)) waiter.reject(error);
  });
  child.once("exit", (code, signal) => {
    terminalError = new Error(`MCP exited before the expected response (code=${code}, signal=${signal})`);
    for (const waiter of waiters.splice(0)) waiter.reject(terminalError);
  });
  return {
    stderr,
    waitFor(predicate, label) {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      if (terminalError) return Promise.reject(terminalError);
      return withTimeout(new Promise((resolve, reject) => {
        waiters.push({ predicate, resolve, reject });
      }), label);
    },
  };
}

async function callTool(child, output, id, name, argumentsValue) {
  writeMessage(child, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: argumentsValue },
  });
  const message = await output.waitFor((candidate) => candidate.id === id, `${name} response`);
  assert.equal(message.jsonrpc, "2.0");
  assert.equal(Object.hasOwn(message, "error"), false, `${name} must return an MCP tool result`);
  assert.equal(message.result.isError, false, `${name} must report success`);
  assert.equal(message.result.structuredContent.schemaVersion, 1);
  return message.result;
}

async function createRepository(root) {
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src/index.ts"), "export const alpha = true;\n");
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: "Understand Code Plugin E2E",
    GIT_AUTHOR_EMAIL: "plugin-e2e@example.invalid",
    GIT_COMMITTER_NAME: "Understand Code Plugin E2E",
    GIT_COMMITTER_EMAIL: "plugin-e2e@example.invalid",
  };
  await execBounded("git", ["init", "-q"], { cwd: root, env: gitEnv });
  await execBounded("git", ["add", "src/index.ts"], { cwd: root, env: gitEnv });
  await execBounded("git", ["commit", "-q", "-m", "initial"], { cwd: root, env: gitEnv });
  return realpath(root);
}

async function resolveMcpServer(installedRoot, host) {
  const config = JSON.parse(await readFile(path.join(installedRoot, ".mcp.json"), "utf8"));
  assert.equal(Object.hasOwn(config, "mcpServers"), false, "plugin MCP config must use the official direct server map");
  assert.equal(Object.hasOwn(config, "mcp_servers"), false, "plugin MCP config must use the official direct server map");
  assert.deepEqual(Object.keys(config), [PLUGIN_NAME]);
  const server = config[PLUGIN_NAME];
  assert.equal(typeof server, "object");
  assert.deepEqual(server.args, ["--host", host]);
  let command = server.command;
  if (host === "claude") {
    assert.match(command, /^\$\{CLAUDE_PLUGIN_ROOT\}\/[A-Za-z0-9_./-]+$/u);
    command = command.replace("${CLAUDE_PLUGIN_ROOT}", installedRoot);
  } else {
    assert.match(command, /^\.\/[A-Za-z0-9_./-]+$/u, "Codex bundled command must be plugin-root relative");
  }
  assert.doesNotMatch(command, /\$\{[^}]+\}/u, "bundled MCP command must not retain an unknown Host placeholder");
  const executable = await realpath(path.resolve(installedRoot, command));
  const canonicalRoot = `${await realpath(installedRoot)}${path.sep}`;
  assert.equal(executable.startsWith(canonicalRoot), true, "bundled command must resolve inside the installed cache root");
  assert.equal((await stat(executable)).isFile(), true);
  await access(executable, fsConstants.X_OK);
  return { executable, args: server.args ?? [] };
}

async function exerciseInstalledMcp({ host, installedRoot, version, repositoryRoot, cwd, env, clientName }) {
  const server = await resolveMcpServer(installedRoot, host);
  const child = spawn(server.executable, server.args, {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const output = collectMessages(child);
  try {
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: clientName, version: "1.0.0" },
      },
    });
    const initialized = await output.waitFor((message) => message.id === 1, `${clientName} initialize`);
    assert.equal(initialized.result.serverInfo.name, "understand-code");
    assert.equal(initialized.result.serverInfo.version, version);
    writeMessage(child, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    writeMessage(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listed = await output.waitFor((message) => message.id === 2, `${clientName} tools/list`);
    assert.equal(Object.hasOwn(listed, "error"), false);
    assert.equal(listed.result.tools.some((tool) => tool.name === "get_repo_pulse"), true);
    assert.equal(listed.result.tools.some((tool) => tool.name === "refresh_index"), true);
    const refreshed = await callTool(child, output, 3, "refresh_index", {
      mode: "full",
      idempotencyKey: `${clientName}-refresh`,
      actor: `agent:${clientName}`,
    });
    assert.equal(refreshed.structuredContent.result.operation.status, "completed");
    const pulse = await callTool(child, output, 4, "get_repo_pulse", {});
    assert.equal(
      pulse.structuredContent.meta.sourceSnapshotId,
      refreshed.structuredContent.meta.sourceSnapshotId,
      "the installed Host plugin must read the exact snapshot it created for the bound repository",
    );
    assert.equal(await realpath(repositoryRoot), repositoryRoot);
    child.stdin.end();
    assert.deepEqual(await waitForExit(child, `${clientName} clean exit`), [0, null]);
    assert.equal(output.stderr.join(""), "");
  } finally {
    await stopChild(child);
  }
  return server;
}

async function expectRootFailure(server, cwd, env, label) {
  const child = spawn(server.executable, server.args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  try {
    assert.deepEqual(await waitForExit(child, label, 5_000), [2, null]);
    assert.equal(stdout.join(""), "");
    assert.equal(stderr.join(""), "workspace_root_required\n");
  } finally {
    await stopChild(child);
  }
}

async function findClaudeInstalledRoot(claudeConfig, version) {
  const cacheRoot = path.join(claudeConfig, "plugins/cache");
  const candidates = [];
  async function visit(directory, depth) {
    if (depth > 6) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = path.join(directory, entry.name);
      const manifestPath = path.join(child, ".claude-plugin/plugin.json");
      try {
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        if (manifest.name === PLUGIN_NAME && manifest.version === version) candidates.push(child);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      await visit(child, depth + 1);
    }
  }
  await visit(cacheRoot, 0);
  assert.equal(candidates.length, 1, "Claude CLI must install exactly one versioned plugin cache root");
  return realpath(candidates[0]);
}

async function assertMissing(target, label) {
  await assert.rejects(access(target), (error) => error?.code === "ENOENT", label);
}

test("real Codex and Claude CLI lifecycles yield cached plugins that execute the packed MCP", async (t) => {
  const originalHome = process.env.HOME ?? "";
  const codexCli = await findExecutable(
    process.env.UNDERSTAND_CODE_CODEX_CLI,
    ["/Applications/ChatGPT.app/Contents/Resources/codex", path.join(originalHome, ".local/bin/codex")],
    "codex",
  );
  const claudeCli = await findExecutable(
    process.env.UNDERSTAND_CODE_CLAUDE_CLI,
    [path.join(originalHome, ".local/bin/claude")],
    "claude",
  );
  if (codexCli === null || claudeCli === null) {
    const message = `real Host CLIs unavailable (codex=${codexCli !== null}, claude=${claudeCli !== null})`;
    if (process.env.UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS === "1") assert.fail(message);
    t.skip(message);
    return;
  }

  const sandbox = await realpath(await mkdtemp(path.join(tmpdir(), "understand-code-plugin-e2e-")));
  const packDirectory = path.join(sandbox, "pack");
  const installDirectory = path.join(sandbox, "npm-prefix");
  const codexHome = path.join(sandbox, "codex-home");
  const codexUserHome = path.join(sandbox, "codex-user");
  const claudeConfig = path.join(sandbox, "claude-config");
  const claudeUserHome = path.join(sandbox, "claude-user");
  const repositoryRoot = await createRepository(path.join(sandbox, "repository"));
  const ambientRepositoryRoot = await createRepository(path.join(sandbox, "ambient-repository"));
  const differentCwd = path.join(sandbox, "not-the-repository");
  let codexInstalledRoot = null;
  let claudeInstalledRoot = null;
  try {
    await Promise.all([
      mkdir(packDirectory, { recursive: true }),
      mkdir(installDirectory, { recursive: true }),
      mkdir(codexHome, { recursive: true }),
      mkdir(codexUserHome, { recursive: true }),
      mkdir(claudeConfig, { recursive: true }),
      mkdir(claudeUserHome, { recursive: true }),
      mkdir(differentCwd, { recursive: true }),
    ]);
    let tarballPath;
    if (process.env.UNDERSTAND_CODE_PREVIEW_TARBALL !== undefined) {
      tarballPath = await realpath(path.resolve(process.env.UNDERSTAND_CODE_PREVIEW_TARBALL));
    } else {
      const packed = await execBounded(
        "npm",
        ["pack", ".", "--ignore-scripts", "--pack-destination", packDirectory, "--json"],
        { cwd: packageRoot, encoding: "utf8", timeout: 120_000 },
      );
      const records = JSON.parse(packed.stdout);
      assert.equal(records.length, 1);
      tarballPath = path.join(packDirectory, records[0].filename);
    }
    await execBounded(
      "npm",
      ["install", "--global", "--prefix", installDirectory, "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarballPath],
      { cwd: installDirectory, encoding: "utf8", timeout: 120_000 },
    );
    const installedPackageRoot = path.join(
      installDirectory,
      process.platform === "win32" ? "node_modules" : "lib/node_modules",
      "@understand-code/preview",
    );
    const packageManifest = JSON.parse(await readFile(path.join(installedPackageRoot, "package.json"), "utf8"));
    const version = packageManifest.version;
    const codexMarketplaceRoot = path.join(installedPackageRoot, "dist/plugin-roots/codex");
    const claudeMarketplaceRoot = path.join(installedPackageRoot, "dist/plugin-roots/claude");

    const codexEnv = cleanHostEnvironment(codexUserHome, { CODEX_HOME: codexHome });
    const codexMarketplace = JSON.parse(
      (await execBounded(codexCli, ["plugin", "marketplace", "add", codexMarketplaceRoot, "--json"], {
        cwd: differentCwd,
        env: codexEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.equal(codexMarketplace.marketplaceName, MARKETPLACE_NAME);
    const codexInstall = JSON.parse(
      (await execBounded(codexCli, ["plugin", "add", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--json"], {
        cwd: differentCwd,
        env: codexEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.equal(codexInstall.pluginId, `${PLUGIN_NAME}@${MARKETPLACE_NAME}`);
    assert.equal(codexInstall.version, version);
    codexInstalledRoot = await realpath(codexInstall.installedPath);
    assert.equal(codexInstalledRoot.startsWith(`${await realpath(codexHome)}${path.sep}`), true);
    const codexList = await execBounded(codexCli, ["plugin", "list"], {
      cwd: differentCwd,
      env: codexEnv,
      encoding: "utf8",
    });
    assert.match(codexList.stdout, /understand-code@understand-code-alpha\s+installed, enabled/u);
    const codexMcpList = JSON.parse(
      (await execBounded(codexCli, ["mcp", "list", "--json"], {
        cwd: differentCwd,
        env: codexEnv,
        encoding: "utf8",
      })).stdout,
    );
    const registeredCodexMcp = codexMcpList.find((server) => server.name === PLUGIN_NAME);
    assert.ok(registeredCodexMcp, "Codex CLI must register the installed plugin MCP server");
    assert.equal(registeredCodexMcp.enabled, true);
    assert.equal(registeredCodexMcp.transport.type, "stdio");
    assert.equal(registeredCodexMcp.transport.command, "./bin/understand-code-plugin.mjs");
    assert.deepEqual(registeredCodexMcp.transport.args, ["--host", "codex"]);
    const registeredCodexMcpDetail = JSON.parse(
      (await execBounded(codexCli, ["mcp", "get", PLUGIN_NAME, "--json"], {
        cwd: differentCwd,
        env: codexEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.equal(registeredCodexMcpDetail.name, PLUGIN_NAME);
    assert.equal(registeredCodexMcpDetail.enabled, true);
    assert.deepEqual(registeredCodexMcpDetail.transport, registeredCodexMcp.transport);
    const codexServer = await exerciseInstalledMcp({
      host: "codex",
      installedRoot: codexInstalledRoot,
      version,
      repositoryRoot,
      cwd: repositoryRoot,
      env: cleanHostEnvironment(codexUserHome, {
        CODEX_HOME: codexHome,
        GIT_DIR: path.join(ambientRepositoryRoot, ".git"),
        GIT_WORK_TREE: ambientRepositoryRoot,
      }),
      clientName: "codex-plugin-e2e",
    });
    await expectRootFailure(
      codexServer,
      differentCwd,
      cleanHostEnvironment(codexUserHome, { CODEX_HOME: codexHome }),
      "Codex plugin must reject a non-repository working root",
    );

    const claudeEnv = cleanHostEnvironment(claudeUserHome, { CLAUDE_CONFIG_DIR: claudeConfig });
    await execBounded(claudeCli, ["plugin", "validate", "--strict", claudeMarketplaceRoot], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    await execBounded(claudeCli, ["plugin", "marketplace", "add", claudeMarketplaceRoot, "--scope", "user"], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    const claudeMarketplaces = JSON.parse(
      (await execBounded(claudeCli, ["plugin", "marketplace", "list", "--json"], {
        cwd: differentCwd,
        env: claudeEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.match(JSON.stringify(claudeMarketplaces), new RegExp(MARKETPLACE_NAME, "u"));
    await execBounded(claudeCli, ["plugin", "install", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--scope", "user"], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    const claudePlugins = JSON.parse(
      (await execBounded(claudeCli, ["plugin", "list", "--json"], {
        cwd: differentCwd,
        env: claudeEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.match(JSON.stringify(claudePlugins), /understand-code@understand-code-alpha/u);
    claudeInstalledRoot = await findClaudeInstalledRoot(claudeConfig, version);
    assert.equal(claudeInstalledRoot.startsWith(`${await realpath(claudeConfig)}${path.sep}`), true);
    const claudeServer = await exerciseInstalledMcp({
      host: "claude",
      installedRoot: claudeInstalledRoot,
      version,
      repositoryRoot,
      cwd: differentCwd,
      env: cleanHostEnvironment(claudeUserHome, {
        CLAUDE_CONFIG_DIR: claudeConfig,
        CLAUDE_PROJECT_DIR: repositoryRoot,
        GIT_DIR: path.join(ambientRepositoryRoot, ".git"),
        GIT_WORK_TREE: ambientRepositoryRoot,
      }),
      clientName: "claude-plugin-e2e",
    });
    assert.equal(
      (await stat(path.join(repositoryRoot, ".understand-code"))).isDirectory(),
      true,
      "both cached MCP launches must publish only inside the explicitly selected repository",
    );
    await assertMissing(
      path.join(ambientRepositoryRoot, ".understand-code"),
      "ambient Git authority must not redirect artifacts into another real repository",
    );
    await expectRootFailure(
      claudeServer,
      differentCwd,
      cleanHostEnvironment(claudeUserHome, { CLAUDE_CONFIG_DIR: claudeConfig }),
      "Claude plugin must reject a missing CLAUDE_PROJECT_DIR",
    );

    assert.deepEqual(
      await readFile(path.join(codexInstalledRoot, "bin/understand-code.mjs")),
      await readFile(path.join(claudeInstalledRoot, "bin/understand-code.mjs")),
      "both mandatory Host plugins must install the same-version bundled MCP executable",
    );

    await execBounded(codexCli, ["plugin", "remove", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--json"], {
      cwd: differentCwd,
      env: codexEnv,
      encoding: "utf8",
    });
    await execBounded(codexCli, ["plugin", "marketplace", "remove", MARKETPLACE_NAME], {
      cwd: differentCwd,
      env: codexEnv,
      encoding: "utf8",
    });
    await assertMissing(codexInstalledRoot, "Codex remove must clean the installed plugin cache");
    codexInstalledRoot = null;
    assert.match(
      (await execBounded(codexCli, ["plugin", "marketplace", "list"], { env: codexEnv, encoding: "utf8" })).stdout,
      /No plugin marketplaces in scope\./u,
    );

    await execBounded(claudeCli, ["plugin", "uninstall", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--scope", "user", "--yes"], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    await execBounded(claudeCli, ["plugin", "marketplace", "remove", MARKETPLACE_NAME, "--scope", "user"], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    const claudeAfter = JSON.parse(
      (await execBounded(claudeCli, ["plugin", "list", "--json"], { env: claudeEnv, encoding: "utf8" })).stdout,
    );
    assert.deepEqual(claudeAfter, []);
    const claudeMarketplacesAfter = JSON.parse(
      (await execBounded(claudeCli, ["plugin", "marketplace", "list", "--json"], {
        env: claudeEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.deepEqual(claudeMarketplacesAfter, []);
    // Claude Code keeps an inert version cache after uninstall; the isolated config sandbox below
    // is the cleanup boundary, while plugin list is the authoritative installation state.
    claudeInstalledRoot = null;
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
