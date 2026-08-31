import { createHash } from "node:crypto";
import {
  access,
  chmod,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  runStep16RealHostJsonlSessionV1,
  Step16RealHostExecutionErrorV1,
  type RunStep16RealHostJsonlSessionV1Input,
  type Step16RealHostExecutionErrorCodeV1,
} from "../src/real-host-executor.js";
import type {
  RealHostReceiptHostV1,
  Step16ExpectedHostEventPlanV1,
} from "../src/real-host-receipts.js";
import {
  deriveStep16ExpectedHostEventPlanDigestV1,
  deriveStep16RealHostActionInputDigestV1,
} from "../src/real-host-receipts.js";

const temporaryDirectories = new Set<string>();
const executableDigests = new Map<string, `sha256:${string}`>();
const EXPECTED_EVENT_PLAN_EVENTS_V1 = Object.freeze([{
    kind: "mcp_tool_call",
    ordinal: 1,
    server: "understand-code",
    tool: "get_repo_pulse",
  } as const]);
const EXPECTED_EVENT_PLAN_V1: Step16ExpectedHostEventPlanV1 = Object.freeze({
  expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(
    EXPECTED_EVENT_PLAN_EVENTS_V1,
  ),
  events: EXPECTED_EVENT_PLAN_EVENTS_V1,
});

const HOST_SHIM_SOURCE_V1 = [
  `#!${process.execPath}`,
  'const { spawn } = require("node:child_process");',
  'const { readFileSync, writeFileSync } = require("node:fs");',
  'const prompt = readFileSync(0, "utf8");',
  'if (process.env.TEST_SPAWN_FILE) writeFileSync(process.env.TEST_SPAWN_FILE, "spawned", { mode: 0o600 });',
  'const expectedArgv = JSON.parse(process.env.TEST_EXPECTED_ARGV);',
  'const forbiddenGitEnvironment = ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"];',
  'const deterministicEnvironment = (process.env.TEST_HOST !== "claude" || process.env.ENABLE_TOOL_SEARCH === "false") && process.env.GIT_OPTIONAL_LOCKS === "0" && forbiddenGitEnvironment.every((key) => !(key in process.env));',
  'if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(expectedArgv) || prompt !== process.env.TEST_EXPECTED_PROMPT || !deterministicEnvironment) {',
  '  process.stderr.write("controlled child input mismatch\\n");',
  '  process.exitCode = 91;',
  '} else if (process.env.TEST_BEHAVIOR === "timeout") {',
  '  process.on("SIGTERM", () => undefined);',
  '  const descendant = spawn(process.execPath, ["-e", "process.on(\\\"SIGTERM\\\",()=>undefined);setInterval(()=>undefined,1000)"], { stdio: "ignore" });',
  '  writeFileSync(process.env.TEST_PID_FILE, String(descendant.pid), { mode: 0o600 });',
  '  setInterval(() => undefined, 1000);',
  '} else if (process.env.TEST_BEHAVIOR === "stdout_cap") {',
  '  process.stdout.write(Buffer.alloc(32 * 1024 * 1024 + 1, 0x61));',
  '} else if (process.env.TEST_BEHAVIOR === "stderr_cap") {',
  '  process.stderr.write(Buffer.alloc(4 * 1024 * 1024 + 1, 0x62));',
  '} else if (process.env.TEST_BEHAVIOR === "invalid_utf8") {',
  '  process.stdout.write(Buffer.from([0xff]));',
  '} else if (process.env.TEST_BEHAVIOR === "signal") {',
  '  process.kill(process.pid, "SIGTERM");',
  '} else {',
  '  process.stdout.write(Buffer.from(process.env.TEST_STDOUT_BASE64 || "", "base64"));',
  '  process.stderr.write(Buffer.from(process.env.TEST_STDERR_BASE64 || "", "base64"));',
  '  process.exitCode = Number(process.env.TEST_EXIT_CODE || "0");',
  '}',
  "",
].join("\n");

afterEach(async () => {
  await Promise.all(
    [...temporaryDirectories].map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
  temporaryDirectories.clear();
  executableDigests.clear();
});

function codexArgvV1(cwd: string): readonly string[] {
  return [
    "exec",
    "--json",
    "--ephemeral",
    "--ignore-rules",
    "--strict-config",
    "--sandbox",
    "read-only",
    "-c",
    'mcp_servers.understand-code.enabled_tools=["get_repo_pulse"]',
    "-C",
    cwd,
    "-",
  ];
}

function claudeArgvV1(): readonly string[] {
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    "--tools",
    "",
    "--allowedTools",
    "mcp__understand-code__get_repo_pulse",
  ];
}

function codexTranscriptV1(): string {
  return [
    { type: "thread.started", thread_id: "codex-session-1" },
    { type: "turn.started" },
    {
      type: "item.started",
      item: {
        type: "mcp_tool_call",
        id: "codex-call-1",
        server: "understand-code",
        tool: "get_repo_pulse",
        arguments: { root: "." },
        status: "in_progress",
        result: null,
        error: null,
      },
    },
    {
      type: "item.completed",
      item: {
        type: "mcp_tool_call",
        id: "codex-call-1",
        server: "understand-code",
        tool: "get_repo_pulse",
        arguments: { root: "." },
        status: "completed",
        result: { content: [] },
        error: null,
      },
    },
    { type: "turn.completed" },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

function codexCommandPairV1(command: string, id: string) {
  return ["started", "completed"].map((phase) => ({
    type: `item.${phase}`,
    item: {
      type: "command_execution",
      id,
      command,
      status: phase === "started" ? "in_progress" : "completed",
      exit_code: phase === "started" ? null : 0,
      aggregated_output: "",
    },
  }));
}

function codexVerificationFixtureV1(commands: readonly string[]) {
  const actions = commands.map((command, index) => ({
    ordinal: index + 2,
    input: { command },
  }));
  const events: Step16ExpectedHostEventPlanV1["events"] = [
    ...EXPECTED_EVENT_PLAN_EVENTS_V1,
    ...actions.map((action) => ({
      kind: "host_action" as const,
      ordinal: action.ordinal,
      action: "verification" as const,
      mechanism: "command_execution" as const,
      inputDigest: deriveStep16RealHostActionInputDigestV1(action.input),
    })),
  ];
  const plan: Step16ExpectedHostEventPlanV1 = {
    expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(events),
    events,
  };
  const pairs = commands.flatMap((command, index) =>
    codexCommandPairV1(command, `codex-command-${index + 1}`)
  );
  const transcript = (commandEvents = pairs): string =>
    codexTranscriptV1().replace(
      '{"type":"turn.completed"}\n',
      `${commandEvents.map((event) => JSON.stringify(event)).join("\n")}\n` +
        '{"type":"turn.completed"}\n',
    );
  return { actions, plan, pairs, transcript };
}

function claudeTranscriptV1(): string {
  return [
    { type: "system", subtype: "init", session_id: "claude-session-1" },
    {
      type: "assistant",
      session_id: "claude-session-1",
      parent_tool_use_id: null,
      message: {
        role: "assistant",
        content: [{
          type: "tool_use",
          id: "claude-call-1",
          name: "mcp__understand-code__get_repo_pulse",
          input: { root: "." },
        }],
      },
    },
    {
      type: "user",
      session_id: "claude-session-1",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: "claude-call-1",
          is_error: false,
          content: [],
        }],
      },
      tool_use_result: {},
    },
    {
      type: "result",
      subtype: "success",
      session_id: "claude-session-1",
      is_error: false,
      permission_denials: [],
    },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

function claudeActionTranscriptV1(
  filePath: string,
  command: string,
): string {
  const toolPair = (
    id: string,
    name: string,
    input: Readonly<Record<string, unknown>>,
  ): readonly Record<string, unknown>[] => [
    {
      type: "assistant",
      session_id: "claude-action-session",
      parent_tool_use_id: null,
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id, name, input }],
      },
    },
    {
      type: "user",
      session_id: "claude-action-session",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: id,
          content: "ok",
        }],
      },
      tool_use_result: { ok: true },
    },
  ];
  return [
    { type: "system", subtype: "init", session_id: "claude-action-session" },
    ...toolPair("write-1", "Write", { file_path: filePath, content: "updated\n" }),
    ...toolPair("bash-1", "Bash", { command }),
    {
      type: "result",
      subtype: "success",
      session_id: "claude-action-session",
      is_error: false,
      permission_denials: [],
    },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

function failedCodexTranscriptV1(secret: string): string {
  return [
    { type: "thread.started", thread_id: "codex-session-failed" },
    { type: "turn.started" },
    { type: "turn.failed", error: { message: secret } },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

function sha256V1(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function fixtureV1(): Promise<Readonly<{
  root: string;
  executable: string;
  executableDigest: `sha256:${string}`;
}>> {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "step16-real-host-executor-")),
  );
  temporaryDirectories.add(root);
  const executable = join(root, "controlled-host");
  await writeFile(executable, HOST_SHIM_SOURCE_V1, "utf8");
  await chmod(executable, 0o755);
  // The controlled fixture digest stands in for a digest pinned by the root-owned closing environment.
  const executableDigest = sha256V1(await readFile(executable));
  executableDigests.set(executable, executableDigest);
  return Object.freeze({ root, executable, executableDigest });
}

function inputV1(options: Readonly<{
  host: RealHostReceiptHostV1;
  root: string;
  executable: string;
  prompt: string;
  behavior?: string;
  stdout?: Uint8Array | string;
  stderr?: Uint8Array | string;
  exitCode?: number;
  timeoutMs?: number;
  pidFile?: string;
  extraEnv?: Readonly<Record<string, string>>;
  expectedArgv?: readonly string[];
  expectedExecutableDigest?: `sha256:${string}`;
  expectedEventPlan?: Step16ExpectedHostEventPlanV1;
  expectedHostActionInputs?: RunStep16RealHostJsonlSessionV1Input["expectedHostActionInputs"];
}>): RunStep16RealHostJsonlSessionV1Input {
  const bytes = (value: Uint8Array | string | undefined): Buffer =>
    typeof value === "string"
      ? Buffer.from(value, "utf8")
      : Buffer.from(value ?? new Uint8Array());
  return {
    host: options.host,
    executable: options.executable,
    expectedExecutableDigest:
      options.expectedExecutableDigest ?? executableDigests.get(options.executable)!,
    cwd: options.root,
    prompt: options.prompt,
    env: {
      TEST_BEHAVIOR: options.behavior ?? "output",
      TEST_HOST: options.host,
      TEST_EXPECTED_ARGV: JSON.stringify(
        options.expectedArgv ?? (options.host === "codex"
          ? codexArgvV1(options.root)
          : claudeArgvV1()),
      ),
      TEST_EXPECTED_PROMPT: options.prompt,
      TEST_STDOUT_BASE64: bytes(options.stdout).toString("base64"),
      TEST_STDERR_BASE64: bytes(options.stderr).toString("base64"),
      TEST_EXIT_CODE: String(options.exitCode ?? 0),
      ...(options.pidFile === undefined ? {} : { TEST_PID_FILE: options.pidFile }),
      ...options.extraEnv,
    },
    expectedEventPlan: options.expectedEventPlan ?? EXPECTED_EVENT_PLAN_V1,
    expectedHostActionInputs: options.expectedHostActionInputs ?? [],
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  };
}

async function captureExecutionErrorV1(
  promise: Promise<unknown>,
): Promise<Step16RealHostExecutionErrorV1> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Step16RealHostExecutionErrorV1);
    return error as Step16RealHostExecutionErrorV1;
  }
  throw new Error("expected real Host execution failure");
}

async function expectProcessMissingV1(pid: number): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (
        typeof error === "object" && error !== null && "code" in error &&
        (error as { readonly code?: unknown }).code === "ESRCH"
      ) return;
      throw error;
    }
    await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 10));
  }
  throw new Error("controlled descendant survived process-group termination");
}

describe("Step16 real Host JSONL executor", () => {
  it.each([
    { host: "codex" as const, transcript: codexTranscriptV1() },
    { host: "claude" as const, transcript: claudeTranscriptV1() },
  ])("runs the exact $host non-interactive argv and returns only safe receipt evidence", async ({ host, transcript }) => {
    const { root, executable, executableDigest } = await fixtureV1();
    const prompt = `trusted-${host}-prompt-secret`;
    const stderr = `controlled ${host} warning\n`;
    const result = await runStep16RealHostJsonlSessionV1(inputV1({
      host,
      root,
      executable,
      prompt,
      stdout: transcript,
      stderr,
      extraEnv: {
        CHILD_ONLY_SECRET: `environment-${host}-secret`,
        ...(host === "claude" ? { ENABLE_TOOL_SEARCH: "true" } : {}),
        GIT_OPTIONAL_LOCKS: "1",
      },
    }));
    expect(result.receipt).toMatchObject({
      schemaVersion: 1,
      host,
      events: [{
        kind: "mcp_tool_call",
        server: "understand-code",
        tool: "get_repo_pulse",
        ordinal: 1,
        success: true,
      }],
    });
    expect(result).toEqual({
      receipt: result.receipt,
      rawTranscriptDigest: sha256V1(transcript),
      stderrDigest: sha256V1(stderr),
      executableDigest,
      exit: { code: 0, signal: null },
    });
    expect(JSON.stringify(result)).not.toContain(prompt);
    expect(result).not.toHaveProperty("stdout");
    expect(result).not.toHaveProperty("stderr");
    expect(result).not.toHaveProperty("prompt");
    expect(result).not.toHaveProperty("env");
  });

  it("fails nonzero exit without retaining prompt, environment, or stderr secrets", async () => {
    const { root, executable } = await fixtureV1();
    const promptSecret = "prompt-secret-35562f64";
    const environmentSecret = "environment-secret-bd308eaf";
    const stderrSecret = "stderr-secret-d3d2453c";
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "codex",
        root,
        executable,
        prompt: promptSecret,
        stderr: stderrSecret,
        exitCode: 7,
        extraEnv: { PRIVATE_TOKEN: environmentSecret },
      })),
    );
    expect(error.code).toBe("nonzero_exit");
    expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
    const exposed = [error.message, error.stack ?? "", JSON.stringify(error)].join("\n");
    for (const secret of [promptSecret, environmentSecret, stderrSecret]) {
      expect(exposed).not.toContain(secret);
    }
  });

  const posixIt = process.platform === "win32" ? it.skip : it;
  posixIt("terminates the POSIX process group after timeout", async () => {
    const { root, executable } = await fixtureV1();
    const pidFile = join(root, "descendant.pid");
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "codex",
        root,
        executable,
        prompt: "timeout-prompt",
        behavior: "timeout",
        timeoutMs: 1_000,
        pidFile,
      })),
    );
    expect(error.code).toBe("timeout");
    const descendantPid = Number(await readFile(pidFile, "utf8"));
    expect(Number.isSafeInteger(descendantPid)).toBe(true);
    await expectProcessMissingV1(descendantPid);
  });

  it.each([
    { behavior: "stdout_cap", code: "stdout_limit_exceeded" as const },
    { behavior: "stderr_cap", code: "stderr_limit_exceeded" as const },
  ])("fails closed at the $behavior byte limit", async ({ behavior, code }) => {
    const { root, executable } = await fixtureV1();
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "codex",
        root,
        executable,
        prompt: "capacity-prompt",
        behavior,
      })),
    );
    expect(error.code).toBe(code);
  });

  it("rejects invalid UTF-8 without returning raw bytes", async () => {
    const { root, executable } = await fixtureV1();
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "codex",
        root,
        executable,
        prompt: "utf8-prompt",
        behavior: "invalid_utf8",
      })),
    );
    expect(error.code).toBe("invalid_utf8");
  });

  it("rejects an internally failed transcript even when the Host exits zero", async () => {
    const { root, executable } = await fixtureV1();
    const transcriptSecret = "internal-host-failure-secret-fd4df3ca";
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "codex",
        root,
        executable,
        prompt: "normalizer-prompt-secret",
        stdout: failedCodexTranscriptV1(transcriptSecret),
      })),
    );
    expect(error.code).toBe("transcript_rejected");
    expect(error.message).not.toContain(transcriptSecret);
  });

  it("rejects a signal exit independently of the outer status code", async () => {
    const { root, executable } = await fixtureV1();
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "claude",
        root,
        executable,
        prompt: "signal-prompt",
        behavior: "signal",
      })),
    );
    expect(error.code satisfies Step16RealHostExecutionErrorCodeV1).toBe(
      "signaled",
    );
  });

  it("validates and freezes the expected plan before spawning", async () => {
    const { root, executable } = await fixtureV1();
    const spawnFile = join(root, "spawned-invalid-plan");
    const invalidPlan = structuredClone(EXPECTED_EVENT_PLAN_V1) as {
      expectedEventPlanDigest: `sha256:${string}`;
      events: Array<{
        kind: "mcp_tool_call";
        ordinal: number;
        server: "understand-code";
        tool: "get_repo_pulse";
      }>;
    };
    invalidPlan.events[0]!.ordinal = 2;
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "codex",
        root,
        executable,
        prompt: "invalid-plan",
        expectedEventPlan: invalidPlan,
        extraEnv: { TEST_SPAWN_FILE: spawnFile },
      })),
    );
    expect(error.code).toBe("invalid_input");
    await expect(access(spawnFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects an unattested executable digest before spawning", async () => {
    const { root, executable } = await fixtureV1();
    const spawnFile = join(root, "spawned-bad-digest");
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "codex",
        root,
        executable,
        prompt: "bad-digest",
        expectedExecutableDigest: sha256V1("another executable"),
        extraEnv: { TEST_SPAWN_FILE: spawnFile },
      })),
    );
    expect(error.code).toBe("invalid_input");
    await expect(access(spawnFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    "LD_PRELOAD",
    "DYLD_INSERT_LIBRARIES",
    "NODE_OPTIONS",
    "DENO_DIR",
    "GIT_CONFIG_COUNT",
    "GIT_EXEC_PATH",
  ])("rejects injecting environment key %s before spawning", async (key) => {
    const { root, executable } = await fixtureV1();
    const spawnFile = join(root, `spawned-env-${key}`);
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "claude",
        root,
        executable,
        prompt: "dangerous-env",
        extraEnv: {
          TEST_SPAWN_FILE: spawnFile,
          [key]: "/attacker/injection",
        },
      })),
    );
    expect(error.code).toBe("invalid_input");
    await expect(access(spawnFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("runs ordered exact Codex verification pairs with the unchanged read-only argv", async () => {
    const { root, executable } = await fixtureV1();
    const fixture = codexVerificationFixtureV1([
      "/opt/understand-code/bin/git diff --check",
      "/opt/understand-code/bin/git status --porcelain=v1",
    ]);
    const result = await runStep16RealHostJsonlSessionV1(inputV1({
      host: "codex",
      root,
      executable,
      prompt: "exact-read-only-verification",
      stdout: fixture.transcript(),
      expectedEventPlan: fixture.plan,
      expectedHostActionInputs: fixture.actions,
      // The controlled child asserts byte-for-byte argv, including read-only.
      expectedArgv: codexArgvV1(root),
    }));
    expect(result.receipt.events).toMatchObject([
      { kind: "mcp_tool_call", ordinal: 1 },
      ...fixture.actions.map(({ ordinal, input }) => ({
        kind: "host_action",
        ordinal,
        action: "verification",
        mechanism: "command_execution",
        inputDigest: deriveStep16RealHostActionInputDigestV1(input),
        success: true,
      })),
    ]);
    expect(result.exit).toEqual({ code: 0, signal: null });
  });

  it.each([
    "changed command",
    "changed completion",
    "changed pair id",
    "nonzero command exit",
    "missing start",
    "missing completion",
    "reordered commands",
    "extra command",
  ])("rejects Codex verification with %s", async (failure) => {
    const { root, executable } = await fixtureV1();
    const fixture = codexVerificationFixtureV1([
      "/opt/understand-code/bin/git diff --check",
      "/opt/understand-code/bin/git status --porcelain=v1",
    ]);
    let pairs = fixture.pairs;
    switch (failure) {
      case "changed command":
        pairs[0]!.item.command = pairs[1]!.item.command = "unexpected-command";
        break;
      case "changed completion": pairs[1]!.item.command = "unexpected-command"; break;
      case "changed pair id": pairs[1]!.item.id = "unpaired-command"; break;
      case "nonzero command exit": pairs[1]!.item.exit_code = 1; break;
      case "missing start": pairs = pairs.slice(1); break;
      case "missing completion": pairs = [pairs[0]!, ...pairs.slice(2)]; break;
      case "reordered commands": pairs = [...pairs.slice(2), ...pairs.slice(0, 2)]; break;
      case "extra command": pairs.push(...codexCommandPairV1("extra-command", "extra-command-id")); break;
    }
    const error = await captureExecutionErrorV1(runStep16RealHostJsonlSessionV1(inputV1({
      host: "codex", root, executable, prompt: "invalid-verification",
      stdout: fixture.transcript(pairs),
      expectedEventPlan: fixture.plan,
      expectedHostActionInputs: fixture.actions,
    })));
    expect(error.code).toBe("transcript_rejected");
  });

  it.each(["missing input", "wrong ordinal", "wrong digest", "extra field"])(
    "rejects Codex verification %s before spawning", async (failure) => {
      const { root, executable } = await fixtureV1();
      const spawnFile = join(root, "spawned-invalid-verification");
      const fixture = codexVerificationFixtureV1(["/opt/understand-code/bin/git diff --check"]);
      let actions: RunStep16RealHostJsonlSessionV1Input["expectedHostActionInputs"] = fixture.actions;
      switch (failure) {
        case "missing input": actions = []; break;
        case "wrong ordinal": actions = [{ ...fixture.actions[0]!, ordinal: 1 }]; break;
        case "wrong digest": actions = [{ ordinal: 2, input: { command: "different-command" } }]; break;
        case "extra field": {
          const input = { command: "/opt/understand-code/bin/git diff --check", extra: true };
          const event = fixture.plan.events[1]!;
          if (event.kind !== "host_action") throw new Error("expected verification event");
          const events = [fixture.plan.events[0]!, { ...event, inputDigest: deriveStep16RealHostActionInputDigestV1(input) }];
          fixture.plan = { events, expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(events) };
          actions = [{ ordinal: 2, input }];
          break;
        }
      }
      const error = await captureExecutionErrorV1(runStep16RealHostJsonlSessionV1(inputV1({
        host: "codex", root, executable, prompt: "invalid-verification-plan",
        stdout: fixture.transcript(),
        expectedEventPlan: fixture.plan,
        expectedHostActionInputs: actions,
        extraEnv: { TEST_SPAWN_FILE: spawnFile },
      })));
      expect(error.code).toBe("invalid_input");
      await expect(access(spawnFile)).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it("still rejects a native Codex source-mutation plan before spawning", async () => {
    const { root, executable } = await fixtureV1();
    const spawnFile = join(root, "spawned-mutable-codex");
    const actionInput = { changes: [{ kind: "update", path: join(root, "src/task.ts") }] };
    const events: Step16ExpectedHostEventPlanV1["events"] = [{
        kind: "host_action",
        ordinal: 1,
        action: "source_mutation",
        mechanism: "file_change",
        inputDigest: deriveStep16RealHostActionInputDigestV1(actionInput),
      }];
    const plan: Step16ExpectedHostEventPlanV1 = {
      expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(events),
      events,
    };
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "codex",
        root,
        executable,
        prompt: "mutable-codex",
        expectedEventPlan: plan,
        expectedHostActionInputs: [{ ordinal: 1, input: actionInput }],
        extraEnv: { TEST_SPAWN_FILE: spawnFile },
      })),
    );
    expect(error.code).toBe("invalid_input");
    await expect(access(spawnFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("derives the exact Claude Write path and Bash command allowlist", async () => {
    const { root, executable, executableDigest } = await fixtureV1();
    const filePath = join(root, "src/task.ts");
    const command = "/opt/understand-code/bin/git diff --check";
    const writeInput = { file_path: filePath, content: "updated\n" };
    const bashInput = { command };
    const events: Step16ExpectedHostEventPlanV1["events"] = [
        {
          kind: "host_action",
          ordinal: 1,
          action: "source_mutation",
          mechanism: "file_change",
          inputDigest: deriveStep16RealHostActionInputDigestV1(writeInput),
        },
        {
          kind: "host_action",
          ordinal: 2,
          action: "verification",
          mechanism: "command_execution",
          inputDigest: deriveStep16RealHostActionInputDigestV1(bashInput),
        },
      ];
    const plan: Step16ExpectedHostEventPlanV1 = {
      expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(events),
      events,
    };
    const expectedArgv = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--no-session-persistence",
      "--permission-mode",
      "dontAsk",
      "--tools",
      "Write,Bash",
      "--allowedTools",
      `Write(${filePath})`,
      `Bash(${command})`,
    ];
    const result = await runStep16RealHostJsonlSessionV1(inputV1({
      host: "claude",
      root,
      executable,
      prompt: "exact-actions",
      stdout: claudeActionTranscriptV1(filePath, command),
      expectedArgv,
      expectedEventPlan: plan,
      expectedHostActionInputs: [
        { ordinal: 1, input: writeInput },
        { ordinal: 2, input: bashInput },
      ],
    }));
    expect(result.executableDigest).toBe(executableDigest);
    expect(result.receipt.events.map((event) => event.kind)).toEqual([
      "host_action",
      "host_action",
    ]);
  });

  it("rejects Claude permission-rule metacharacters before spawning", async () => {
    const { root, executable } = await fixtureV1();
    const spawnFile = join(root, "spawned-permission-metachar");
    const bashInput = { command: "/opt/understand-code/bin/git diff --check?" };
    const events: Step16ExpectedHostEventPlanV1["events"] = [{
        kind: "host_action",
        ordinal: 1,
        action: "verification",
        mechanism: "command_execution",
        inputDigest: deriveStep16RealHostActionInputDigestV1(bashInput),
      }];
    const plan: Step16ExpectedHostEventPlanV1 = {
      expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(events),
      events,
    };
    const error = await captureExecutionErrorV1(
      runStep16RealHostJsonlSessionV1(inputV1({
        host: "claude",
        root,
        executable,
        prompt: "permission-metachar",
        expectedEventPlan: plan,
        expectedHostActionInputs: [{ ordinal: 1, input: bashInput }],
        extraEnv: { TEST_SPAWN_FILE: spawnFile },
      })),
    );
    expect(error.code).toBe("invalid_input");
    await expect(access(spawnFile)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
