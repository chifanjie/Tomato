import { createHash } from "node:crypto";
import { getEventListeners } from "node:events";
import {
  access,
  chmod,
  chown,
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as publicHostAdapters from "../src/index.js";
import type {
  RunStep16RealHostJsonlSessionV1Input,
  Step16ExpectedHostActionInputV1,
  Step16RealHostExecutionErrorCodeV1,
  Step16RealHostJsonlSessionResultV1,
} from "../src/index.js";
import {
  runStep16RealHostJsonlSessionV1,
  runStep16RealHostJsonlSessionWithSupervisorInternalV1,
  Step16RealHostExecutionErrorV1,
  type RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options,
} from "../src/real-host-executor.js";
import {
  createStep16RealHostStreamObserverInternalV1,
  type Step16RealHostObservedCallInternalV1,
  type Step16RealHostStreamObserverInternalV1,
} from "../src/step16-real-host-stream-observer-internal.js";
import {
  deriveStep16ExpectedHostEventPlanDigestV1,
  type Step16ExpectedHostEventPlanV1,
} from "../src/real-host-receipts.js";

const temporaryDirectories = new Set<string>();
const IS_EFFECTIVE_ROOT_V1 = process.geteuid?.() === 0;
const IS_LINUX_ROOT_V1 = process.platform === "linux" && IS_EFFECTIVE_ROOT_V1 &&
  process.getegid?.() === 0;
const CHILD_IDENTITY_V1 = Object.freeze({ uid: 65_534, gid: 65_534 });

const EXPECTED_EVENTS_V1 = Object.freeze([{
  kind: "mcp_tool_call",
  ordinal: 1,
  server: "understand-code",
  tool: "get_repo_pulse",
} as const]);
const EXPECTED_PLAN_V1: Step16ExpectedHostEventPlanV1 = Object.freeze({
  expectedEventPlanDigest: deriveStep16ExpectedHostEventPlanDigestV1(
    EXPECTED_EVENTS_V1,
  ),
  events: EXPECTED_EVENTS_V1,
});

const HOST_SHIM_SOURCE_V1 = [
  `#!${process.execPath}`,
  'const { readFileSync, writeFileSync } = require("node:fs");',
  'readFileSync(0);',
  'if (process.env.TEST_IDENTITY_FILE) writeFileSync(process.env.TEST_IDENTITY_FILE, JSON.stringify({ pid: process.pid, uid: process.getuid(), euid: process.geteuid(), gid: process.getgid(), egid: process.getegid(), groups: process.getgroups() }), { mode: 0o600 });',
  'if (process.env.TEST_SPAWN_FILE) writeFileSync(process.env.TEST_SPAWN_FILE, "spawned", { mode: 0o600 });',
  'if (process.env.TEST_EXIT_FILE) process.on("exit", code => writeFileSync(process.env.TEST_EXIT_FILE, String(code), { mode: 0o600 }));',
  'const chunks = JSON.parse(process.env.TEST_CHUNKS_BASE64 || "[]");',
  'let index = 0;',
  'const writeNext = () => {',
  '  if (index >= chunks.length) {',
  '    if (process.env.TEST_HOLD_OPEN === "true") setInterval(() => undefined, 1000);',
  '    return;',
  '  }',
  '  let chunk = Buffer.from(chunks[index++], "base64");',
  '  if (index === chunks.length && process.env.TEST_STDOUT_PAD_BYTES) chunk = Buffer.concat([chunk, Buffer.alloc(Number(process.env.TEST_STDOUT_PAD_BYTES), 0x20)]);',
  '  process.stdout.write(chunk, () => setImmediate(writeNext));',
  '};',
  'writeNext();',
  "",
].join("\n");

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    [...temporaryDirectories].map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
  temporaryDirectories.clear();
});

function transcriptV1(): string {
  return [
    { type: "thread.started", thread_id: "private-supervised-session" },
    { type: "turn.started" },
    {
      type: "item.started",
      item: {
        id: "private-supervised-call",
        type: "mcp_tool_call",
        server: "understand-code",
        tool: "get_repo_pulse",
        arguments: { root: "/private/root", nested: { beta: 2, alpha: 1 } },
        status: "in_progress",
        result: null,
        error: null,
      },
    },
    {
      type: "item.completed",
      item: {
        id: "private-supervised-call",
        type: "mcp_tool_call",
        server: "understand-code",
        tool: "get_repo_pulse",
        arguments: { nested: { alpha: 1, beta: 2 }, root: "/private/root" },
        status: "completed",
        result: {
          content: [{ type: "text", text: "private unicode result 🙂" }],
          structured_content: { ok: true },
        },
        error: null,
      },
    },
    { type: "turn.completed" },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

function sha256V1(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function fixtureV1(rootProtected = false): Promise<Readonly<{
  root: string;
  executable: string;
  executableDigest: `sha256:${string}`;
}>> {
  const root = await realpath(
    await mkdtemp(join(rootProtected ? "/opt" : tmpdir(), "step16-supervised-executor-")),
  );
  temporaryDirectories.add(root);
  if (rootProtected) await chmod(root, 0o755);
  const executable = join(root, "controlled-host");
  await writeFile(executable, HOST_SHIM_SOURCE_V1, "utf8");
  await chmod(executable, 0o755);
  return Object.freeze({
    root,
    executable,
    executableDigest: sha256V1(await readFile(executable)),
  });
}

function chunksV1(value: string, splitUtf8: boolean): readonly string[] {
  const bytes = Buffer.from(value, "utf8");
  if (!splitUtf8) return Object.freeze([bytes.toString("base64")]);
  const emoji = Buffer.from("🙂", "utf8");
  const emojiOffset = bytes.indexOf(emoji);
  if (emojiOffset < 0) throw new Error("fixture is missing split character");
  return Object.freeze([
    bytes.subarray(0, 7).toString("base64"),
    bytes.subarray(7, emojiOffset + 1).toString("base64"),
    bytes.subarray(emojiOffset + 1, emojiOffset + 3).toString("base64"),
    bytes.subarray(emojiOffset + 3).toString("base64"),
  ]);
}

function inputV1(
  fixture: Readonly<{
    root: string;
    executable: string;
    executableDigest: `sha256:${string}`;
  }>,
  options: Readonly<{
    chunks?: readonly string[];
    holdOpen?: boolean;
    spawnFile?: string;
    exitFile?: string;
    identityFile?: string;
    stdoutPaddingBytes?: number;
  }> = {},
): RunStep16RealHostJsonlSessionV1Input {
  return {
    host: "codex",
    executable: fixture.executable,
    expectedExecutableDigest: fixture.executableDigest,
    cwd: fixture.root,
    prompt: "private controlled prompt",
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      TEST_CHUNKS_BASE64: JSON.stringify(
        options.chunks ?? chunksV1(transcriptV1(), false),
      ),
      ...(options.holdOpen ? { TEST_HOLD_OPEN: "true" } : {}),
      ...(options.spawnFile === undefined
        ? {}
        : { TEST_SPAWN_FILE: options.spawnFile }),
      ...(options.exitFile === undefined ? {} : { TEST_EXIT_FILE: options.exitFile }),
      ...(options.identityFile === undefined
        ? {} : { TEST_IDENTITY_FILE: options.identityFile }),
      ...(options.stdoutPaddingBytes === undefined
        ? {}
        : { TEST_STDOUT_PAD_BYTES: String(options.stdoutPaddingBytes) }),
    },
    expectedEventPlan: EXPECTED_PLAN_V1,
    expectedHostActionInputs: [],
    timeoutMs: 3_000,
  };
}

function recordingObserverV1(
  timeline: string[],
  finishCounter?: { value: number },
): Step16RealHostStreamObserverInternalV1 {
  const observer = createStep16RealHostStreamObserverInternalV1(
    "codex",
    EXPECTED_PLAN_V1,
  );
  return Object.freeze({
    feed(line: string) {
      const event = observer.feed(line);
      timeline.push(
        event === undefined
          ? "feed:non-call"
          : Object.hasOwn(event, "success")
          ? "feed:complete"
          : "feed:start",
      );
      return event;
    },
    finish() {
      if (finishCounter !== undefined) finishCounter.value += 1;
      timeline.push("finish");
      return observer.finish();
    },
  });
}

async function expectExecutionCodeV1(
  operation: Promise<unknown>,
  code: Step16RealHostExecutionErrorV1["code"],
): Promise<void> {
  try {
    await operation;
    expect.fail("expected supervised executor rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(Step16RealHostExecutionErrorV1);
    expect((error as Step16RealHostExecutionErrorV1).code).toBe(code);
  }
}

// These are ordinary-principal behavior tests. Root runs use the separate real
// Linux launch cases below instead of silently starting an un-dropped Host.
describe.skipIf(IS_EFFECTIVE_ROOT_V1)("Step16 supervised real Host executor (internal)", () => {
  it("serializes observed callbacks before later lines across split UTF-8 chunks", async () => {
    const fixture = await fixtureV1();
    const timeline: string[] = [];
    const observed: Step16RealHostObservedCallInternalV1[] = [];
    let activeCallbacks = 0;
    let maximumActiveCallbacks = 0;
    const controller = new AbortController();

    const result = await runStep16RealHostJsonlSessionWithSupervisorInternalV1(
      inputV1(fixture, { chunks: chunksV1(transcriptV1(), true) }),
      {
        signal: controller.signal,
        streamObserver: recordingObserverV1(timeline),
        async onObservedCall(event) {
          observed.push(event);
          activeCallbacks += 1;
          maximumActiveCallbacks = Math.max(maximumActiveCallbacks, activeCallbacks);
          const phase = Object.hasOwn(event, "success") ? "complete" : "start";
          timeline.push(`callback:${phase}:begin`);
          await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 20));
          timeline.push(`callback:${phase}:end`);
          activeCallbacks -= 1;
        },
      },
    );

    expect(maximumActiveCallbacks).toBe(1);
    expect(observed).toHaveLength(2);
    expect(timeline.indexOf("callback:start:end")).toBeLessThan(
      timeline.indexOf("feed:complete"),
    );
    expect(timeline.indexOf("callback:complete:end")).toBeLessThan(
      timeline.indexOf("finish"),
    );
    expect(JSON.stringify(observed)).not.toContain("private");
    expect(JSON.stringify(observed)).not.toContain("🙂");
    expect(result.receipt.events).toHaveLength(1);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("terminates on callback rejection and never calls observer.finish", async () => {
    const fixture = await fixtureV1();
    const finishCounter = { value: 0 };
    const timeline: string[] = [];
    let observedSignal: AbortSignal | undefined;

    await expectExecutionCodeV1(
      runStep16RealHostJsonlSessionWithSupervisorInternalV1(
        inputV1(fixture, { holdOpen: true }),
        {
          streamObserver: recordingObserverV1(timeline, finishCounter),
          onObservedCall(event, signal) {
            if (!Object.hasOwn(event, "success")) {
              observedSignal = signal;
              signal.addEventListener(
                "abort",
                () => timeline.push("callback:abort"),
                { once: true },
              );
              throw new Error("controlled callback rejection");
            }
          },
        },
      ),
      "io_failed",
    );

    expect(timeline).toContain("feed:start");
    expect(timeline).toContain("callback:abort");
    expect(timeline).not.toContain("feed:complete");
    expect(finishCounter.value).toBe(0);
    expect(observedSignal?.aborted).toBe(true);
    expect(observedSignal?.reason).toMatchObject({ code: "io_failed" });
  });

  it("times out even when an exited Host leaves paused unread stdout", async () => {
    const fixture = await fixtureV1();
    const finishCounter = { value: 0 };
    const timeline: string[] = [];
    const exitFile = join(fixture.root, "host-exit-code");
    let observedSignal: AbortSignal | undefined;
    const started = Date.now();

    await expectExecutionCodeV1(
      runStep16RealHostJsonlSessionWithSupervisorInternalV1(
        {
          ...inputV1(fixture, { exitFile, stdoutPaddingBytes: 180_000 }),
          timeoutMs: 1_000,
        },
        {
          streamObserver: recordingObserverV1(timeline, finishCounter),
          onObservedCall(_event, signal) {
            observedSignal = signal;
            return new Promise<void>(() => undefined);
          },
        },
      ),
      "timeout",
    );

    expect(Date.now() - started).toBeLessThan(2_500);
    // A zero exit marker proves this was not just a live Host killed by timeout.
    expect(await readFile(exitFile, "utf8")).toBe("0");
    expect(observedSignal?.aborted).toBe(true);
    expect(timeline).toContain("feed:start");
    expect(timeline).not.toContain("feed:complete");
    expect(finishCounter.value).toBe(0);
  }, 4_000);

  it("aborts a timed-out pending callback and invalidates its late completion", async () => {
    const fixture = await fixtureV1();
    const finishCounter = { value: 0 };
    const timeline: string[] = [];
    let callbackCount = 0;
    let observedSignal: AbortSignal | undefined;
    let resolvePending: (() => void) | undefined;

    await expectExecutionCodeV1(
      runStep16RealHostJsonlSessionWithSupervisorInternalV1(
        {
          ...inputV1(fixture, { holdOpen: true }),
          timeoutMs: 1_000,
        },
        {
          streamObserver: recordingObserverV1(timeline, finishCounter),
          onObservedCall(_event, signal) {
            callbackCount += 1;
            observedSignal = signal;
            timeline.push("callback:started");
            signal.addEventListener(
              "abort",
              () => timeline.push("callback:abort"),
              { once: true },
            );
            return new Promise<void>((resolvePendingCallback) => {
              resolvePending = () => {
                timeline.push(`callback:late:${signal.aborted}`);
                resolvePendingCallback();
              };
            });
          },
        },
      ),
      "timeout",
    );
    timeline.push("executor:returned");

    expect(callbackCount).toBe(1);
    expect(observedSignal?.aborted).toBe(true);
    expect(observedSignal?.reason).toMatchObject({ code: "timeout" });
    expect(timeline.indexOf("callback:abort")).toBeLessThan(
      timeline.indexOf("executor:returned"),
    );
    expect(timeline).not.toContain("feed:complete");
    expect(finishCounter.value).toBe(0);

    expect(resolvePending).toBeTypeOf("function");
    resolvePending?.();
    await new Promise<void>((resolveImmediate) => setImmediate(resolveImmediate));
    expect(timeline).toContain("callback:late:true");
    expect(callbackCount).toBe(1);
    expect(timeline).not.toContain("feed:complete");
    expect(finishCounter.value).toBe(0);
  });

  it("does not expose the internal capability from the public index", () => {
    expect(publicHostAdapters.runStep16RealHostJsonlSessionV1).toBe(
      runStep16RealHostJsonlSessionV1,
    );
    expect(publicHostAdapters.Step16RealHostExecutionErrorV1).toBe(
      Step16RealHostExecutionErrorV1,
    );
    expect(publicHostAdapters).not.toHaveProperty(
      "runStep16RealHostJsonlSessionWithSupervisorInternalV1",
    );
    type PublicHasInternal =
      "runStep16RealHostJsonlSessionWithSupervisorInternalV1" extends
        keyof typeof publicHostAdapters ? true : false;
    type PublicExecutorTypes = readonly [
      RunStep16RealHostJsonlSessionV1Input,
      Step16ExpectedHostActionInputV1,
      Step16RealHostExecutionErrorCodeV1,
      Step16RealHostJsonlSessionResultV1,
    ];
    const publicHasInternal: PublicHasInternal = false;
    const publicExecutorTypesRemainAvailable: PublicExecutorTypes | undefined = undefined;
    expect(publicHasInternal).toBe(false);
    expect(publicExecutorTypesRemainAvailable).toBeUndefined();
  });

  it("rejects option accessors and snapshots mutable observer methods", async () => {
    const fixture = await fixtureV1();
    let accessorReads = 0;
    const accessorOptions = {
      onObservedCall() {},
    } as Record<string, unknown>;
    Object.defineProperty(accessorOptions, "streamObserver", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return recordingObserverV1([]);
      },
    });
    await expectExecutionCodeV1(
      runStep16RealHostJsonlSessionWithSupervisorInternalV1(
        inputV1(fixture),
        accessorOptions as unknown as
          RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options,
      ),
      "invalid_input",
    );
    expect(accessorReads).toBe(0);

    const delegated = recordingObserverV1([]);
    const mutableObserver = {
      feed: (line: string) => delegated.feed(line),
      finish: () => delegated.finish(),
    };
    const execution = runStep16RealHostJsonlSessionWithSupervisorInternalV1(
      inputV1(fixture),
      { streamObserver: mutableObserver, onObservedCall() {} },
    );
    mutableObserver.feed = () => {
      throw new Error("mutated observer feed");
    };
    mutableObserver.finish = () => {
      throw new Error("mutated observer finish");
    };
    const result = await execution;
    expect(result.receipt.events).toHaveLength(1);
  });

  it("rejects child identity controls outside a Linux root supervisor", async () => {
    const fixture = await fixtureV1();
    const spawnFile = join(fixture.root, "spawned");

    await expectExecutionCodeV1(
      runStep16RealHostJsonlSessionWithSupervisorInternalV1(
        inputV1(fixture, { spawnFile }),
        {
          streamObserver: recordingObserverV1([]),
          onObservedCall() {},
          childIdentity: { uid: 65_534, gid: 65_534 },
        },
      ),
      "invalid_input",
    );
    await expect(access(spawnFile)).rejects.toThrow();
  });

  it("rejects root supervision without explicit child identity before spawning", async () => {
    const fixture = await fixtureV1();
    const spawnFile = join(fixture.root, "spawned");
    vi.spyOn(process as NodeJS.Process & { geteuid(): number }, "geteuid").mockReturnValue(0);
    await expectExecutionCodeV1(runStep16RealHostJsonlSessionWithSupervisorInternalV1(
      inputV1(fixture, { spawnFile }),
      { streamObserver: recordingObserverV1([]), onObservedCall() {} },
    ), "invalid_input");
    await expect(access(spawnFile)).rejects.toThrow();
  });

  it("never invokes child identity accessors", async () => {
    const fixture = await fixtureV1();
    let reads = 0;
    for (const nested of [false, true]) {
      const options: Record<string, unknown> = {
        streamObserver: recordingObserverV1([]), onObservedCall() {},
      };
      if (nested) {
        const childIdentity = { gid: 65_534 };
        Object.defineProperty(childIdentity, "uid", { enumerable: true,
          get() { reads += 1; return 65_534; } });
        options.childIdentity = childIdentity;
      } else {
        Object.defineProperty(options, "childIdentity", { enumerable: true,
          get() { reads += 1; return CHILD_IDENTITY_V1; } });
      }
      await expectExecutionCodeV1(runStep16RealHostJsonlSessionWithSupervisorInternalV1(
        inputV1(fixture), options as unknown as RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options,
      ), "invalid_input");
    }
    expect(reads).toBe(0);
  });

  for (const when of ["before_call", "during_validation"] as const) {
    it(`rejects cancellation ${when} without spawning`, async () => {
      const fixture = await fixtureV1();
      const spawnFile = join(fixture.root, "spawned");
      const controller = new AbortController();
      if (when === "before_call") controller.abort("private cancellation reason");
      const execution = runStep16RealHostJsonlSessionWithSupervisorInternalV1(
        inputV1(fixture, { spawnFile }), {
          signal: controller.signal,
          streamObserver: recordingObserverV1([]), onObservedCall() {},
        },
      );
      if (when === "during_validation") controller.abort("private cancellation reason");
      await expectExecutionCodeV1(execution, "io_failed");
      await expect(access(spawnFile)).rejects.toThrow();
      expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
    });
  }

  it("cancels a silent live child and leaves no observer callbacks", async () => {
    const fixture = await fixtureV1();
    const identityFile = join(fixture.root, "identity.json");
    const controller = new AbortController();
    const finishCounter = { value: 0 };
    let callbackCount = 0;
    const execution = runStep16RealHostJsonlSessionWithSupervisorInternalV1(
      inputV1(fixture, { identityFile, chunks: [], holdOpen: true }), {
        signal: controller.signal,
        streamObserver: recordingObserverV1([], finishCounter),
        onObservedCall() { callbackCount += 1; },
      },
    );
    let childPid: number | undefined;
    await expect.poll(async () => {
      try {
        childPid = JSON.parse(await readFile(identityFile, "utf8")).pid as number;
        return childPid;
      } catch { return undefined; }
    }, { interval: 10, timeout: 2_000 }).toBeTypeOf("number");
    controller.abort();
    await expectExecutionCodeV1(execution, "io_failed");
    expect(() => process.kill(childPid!, 0)).toThrow();
    expect(callbackCount).toBe(0);
    expect(finishCounter.value).toBe(0);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("cancels a pending observation and rejects its late completion", async () => {
    const fixture = await fixtureV1();
    const controller = new AbortController();
    const finishCounter = { value: 0 };
    const timeline: string[] = [];
    let observedSignal: AbortSignal | undefined;
    let resolveCallback: (() => void) | undefined;
    let started: (() => void) | undefined;
    const callbackStarted = new Promise<void>((resolve) => { started = resolve; });
    let callbackCount = 0;
    const execution = runStep16RealHostJsonlSessionWithSupervisorInternalV1(
      inputV1(fixture, { holdOpen: true }), {
        signal: controller.signal,
        streamObserver: recordingObserverV1(timeline, finishCounter),
        onObservedCall(_event, signal) {
          callbackCount += 1;
          observedSignal = signal;
          started?.();
          return new Promise<void>((resolve) => { resolveCallback = resolve; });
        },
      },
    );
    await callbackStarted;
    controller.abort();
    await expectExecutionCodeV1(execution, "io_failed");
    expect(observedSignal?.aborted).toBe(true);
    resolveCallback?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(callbackCount).toBe(1);
    expect(timeline).not.toContain("feed:complete");
    expect(finishCounter.value).toBe(0);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("rejects fake signals and signal accessors without invoking them", async () => {
    const fixture = await fixtureV1();
    let reads = 0;
    const accessorOptions = {
      streamObserver: recordingObserverV1([]), onObservedCall() {},
    } as Record<string, unknown>;
    Object.defineProperty(accessorOptions, "signal", { enumerable: true,
      get() { reads += 1; return new AbortController().signal; } });
    await expectExecutionCodeV1(runStep16RealHostJsonlSessionWithSupervisorInternalV1(
      inputV1(fixture), accessorOptions as unknown as RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options,
    ), "invalid_input");
    await expectExecutionCodeV1(runStep16RealHostJsonlSessionWithSupervisorInternalV1(
      inputV1(fixture), { streamObserver: recordingObserverV1([]), onObservedCall() {},
        signal: { aborted: false } as AbortSignal },
    ), "invalid_input");
    expect(reads).toBe(0);
  });

  it("does not publish success if the signal aborts during observer finalization", async () => {
    const fixture = await fixtureV1();
    const controller = new AbortController();
    const observer = recordingObserverV1([]);
    await expectExecutionCodeV1(runStep16RealHostJsonlSessionWithSupervisorInternalV1(
      inputV1(fixture), {
        signal: controller.signal,
        streamObserver: {
          feed: (line) => observer.feed(line),
          finish() { controller.abort(); return observer.finish(); },
        },
        onObservedCall() {},
      },
    ), "io_failed");
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("keeps supervisor-only fields unread by the public wrapper", async () => {
    const fixture = await fixtureV1();
    const input = { ...inputV1(fixture) } as RunStep16RealHostJsonlSessionV1Input &
      Record<string, unknown>;
    Object.defineProperty(input, "childIdentity", {
      enumerable: true,
      get() {
        throw new Error("public wrapper read internal child identity");
      },
    });
    Object.defineProperty(input, "streamObserver", {
      enumerable: true,
      get() {
        throw new Error("public wrapper read internal stream observer");
      },
    });
    Object.defineProperty(input, "signal", {
      enumerable: true,
      get() { throw new Error("public wrapper read internal AbortSignal"); },
    });

    const result = await runStep16RealHostJsonlSessionV1(input);
    expect(result.receipt.events).toHaveLength(1);
  });
});

describe.skipIf(!IS_LINUX_ROOT_V1)("Step16 supervised Linux root launch (internal)", () => {
  async function rootFixtureV1() {
    const fixture = await fixtureV1(true);
    const callerRoot = join(fixture.root, "caller-worktree");
    await mkdir(callerRoot, { mode: 0o700 });
    await chown(callerRoot, CHILD_IDENTITY_V1.uid, CHILD_IDENTITY_V1.gid);
    return { ...fixture, callerRoot };
  }

  it("drops uid/gid and supplementary root groups while root retains the raw stream", async () => {
    const fixture = await rootFixtureV1();
    const identityFile = join(fixture.callerRoot, "identity.json");
    const input = {
      ...inputV1(fixture, { identityFile }), cwd: fixture.callerRoot,
    };
    const identity = { ...CHILD_IDENTITY_V1 } as { uid: number; gid: number };
    const seen: Step16RealHostObservedCallInternalV1[] = [];
    const execution = runStep16RealHostJsonlSessionWithSupervisorInternalV1(input, {
      childIdentity: identity,
      streamObserver: recordingObserverV1([]),
      onObservedCall(event) { seen.push(event); },
    });
    // Both identities and launch paths were captured before the first await.
    identity.uid = 0;
    identity.gid = 0;
    input.executable = "/missing/mutated-launch-path";
    const result = await execution;
    const actual = JSON.parse(await readFile(identityFile, "utf8"));
    expect(actual.uid).toBe(CHILD_IDENTITY_V1.uid);
    expect(actual.euid).toBe(CHILD_IDENTITY_V1.uid);
    expect(actual.gid).toBe(CHILD_IDENTITY_V1.gid);
    expect(actual.egid).toBe(CHILD_IDENTITY_V1.gid);
    expect(actual.groups).not.toContain(0);
    expect(actual.groups.every((gid: number) => gid === CHILD_IDENTITY_V1.gid)).toBe(true);
    expect(process.geteuid?.()).toBe(0);
    expect(process.getegid?.()).toBe(0);
    expect(seen).toHaveLength(2);
    expect(result.exit).toEqual({ code: 0, signal: null });
  });

  it("rejects omitted, root, malformed, and extra child identity fields before spawn", async () => {
    const fixture = await rootFixtureV1();
    const spawnFile = join(fixture.callerRoot, "spawned");
    const invalidIdentities: unknown[] = [
      undefined, { uid: 0, gid: 65_534 }, { uid: 65_534, gid: 0 },
      { uid: -1, gid: 65_534 }, { uid: 1.5, gid: 65_534 },
      { uid: 2 ** 31, gid: 65_534 }, { uid: "65534", gid: 65_534 },
      { uid: 65_534 }, { ...CHILD_IDENTITY_V1, supplementaryGroups: [0] },
    ];
    for (const childIdentity of invalidIdentities) {
      const options = {
        streamObserver: recordingObserverV1([]), onObservedCall() {},
        ...(childIdentity === undefined ? {} : { childIdentity }),
      } as unknown as RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options;
      await expectExecutionCodeV1(runStep16RealHostJsonlSessionWithSupervisorInternalV1(
        { ...inputV1(fixture, { spawnFile }), cwd: fixture.callerRoot }, options,
      ), "invalid_input");
    }
    await expect(access(spawnFile)).rejects.toThrow();
  });

  for (const mutation of [
    "file_owner", "parent_owner", "file_writable", "parent_writable",
    "symlink_file", "symlink_parent", "hardlink_file", "setuid", "setgid", "digest",
  ] as const) {
    it(`rejects unsafe ${mutation} before the child starts`, async () => {
      const fixture = await rootFixtureV1();
      const spawnFile = join(fixture.callerRoot, "spawned");
      const input = { ...inputV1(fixture, { spawnFile }), cwd: fixture.callerRoot };
      if (mutation === "file_owner") await chown(fixture.executable, 65_534, 65_534);
      else if (mutation === "parent_owner") await chown(fixture.root, 65_534, 65_534);
      else if (mutation === "file_writable") await chmod(fixture.executable, 0o775);
      else if (mutation === "parent_writable") await chmod(fixture.root, 0o775);
      else if (mutation === "symlink_file") {
        input.executable = join(fixture.root, "host-link");
        await symlink(fixture.executable, input.executable);
      } else if (mutation === "symlink_parent") {
        const linkedParent = join(fixture.root, "parent-link");
        await symlink(fixture.root, linkedParent);
        input.executable = join(linkedParent, "controlled-host");
      } else if (mutation === "hardlink_file") {
        await link(fixture.executable, join(fixture.root, "host-hardlink"));
      } else if (mutation === "setuid") await chmod(fixture.executable, 0o4755);
      else if (mutation === "setgid") await chmod(fixture.executable, 0o2755);
      else input.expectedExecutableDigest = `sha256:${"0".repeat(64)}`;
      await expectExecutionCodeV1(runStep16RealHostJsonlSessionWithSupervisorInternalV1(input, {
        childIdentity: CHILD_IDENTITY_V1,
        streamObserver: recordingObserverV1([]), onObservedCall() {},
      }), "invalid_input");
      await expect(access(spawnFile)).rejects.toThrow();
    });
  }
});
