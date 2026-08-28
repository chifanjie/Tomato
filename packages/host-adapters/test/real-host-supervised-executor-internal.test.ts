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
  'if (process.env.TEST_SPAWN_FILE) writeFileSync(process.env.TEST_SPAWN_FILE, "spawned", { mode: 0o600 });',
  'const chunks = JSON.parse(process.env.TEST_CHUNKS_BASE64 || "[]");',
  'let index = 0;',
  'const writeNext = () => {',
  '  if (index >= chunks.length) {',
  '    if (process.env.TEST_HOLD_OPEN === "true") setInterval(() => undefined, 1000);',
  '    return;',
  '  }',
  '  const chunk = Buffer.from(chunks[index++], "base64");',
  '  process.stdout.write(chunk, () => setImmediate(writeNext));',
  '};',
  'writeNext();',
  "",
].join("\n");

afterEach(async () => {
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

async function fixtureV1(): Promise<Readonly<{
  root: string;
  executable: string;
  executableDigest: `sha256:${string}`;
}>> {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "step16-supervised-executor-")),
  );
  temporaryDirectories.add(root);
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

describe("Step16 supervised real Host executor (internal)", () => {
  it("serializes observed callbacks before later lines across split UTF-8 chunks", async () => {
    const fixture = await fixtureV1();
    const timeline: string[] = [];
    const observed: Step16RealHostObservedCallInternalV1[] = [];
    let activeCallbacks = 0;
    let maximumActiveCallbacks = 0;

    const result = await runStep16RealHostJsonlSessionWithSupervisorInternalV1(
      inputV1(fixture, { chunks: chunksV1(transcriptV1(), true) }),
      {
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
  });

  it("terminates on callback rejection and never calls observer.finish", async () => {
    const fixture = await fixtureV1();
    const finishCounter = { value: 0 };
    const timeline: string[] = [];

    await expectExecutionCodeV1(
      runStep16RealHostJsonlSessionWithSupervisorInternalV1(
        inputV1(fixture, { holdOpen: true }),
        {
          streamObserver: recordingObserverV1(timeline, finishCounter),
          onObservedCall(event) {
            if (!Object.hasOwn(event, "success")) {
              throw new Error("controlled callback rejection");
            }
          },
        },
      ),
      "io_failed",
    );

    expect(timeline).toContain("feed:start");
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

  it("rejects unsupported child identity controls before spawning", async () => {
    const fixture = await fixtureV1();
    const spawnFile = join(fixture.root, "spawned");

    await expectExecutionCodeV1(
      runStep16RealHostJsonlSessionWithSupervisorInternalV1(
        inputV1(fixture, { spawnFile }),
        {
          streamObserver: recordingObserverV1([]),
          onObservedCall() {},
          childIdentity: { uid: 65_534, gid: 65_534 },
        } as unknown as
          RunStep16RealHostJsonlSessionWithSupervisorInternalV1Options,
      ),
      "invalid_input",
    );
    await expect(access(spawnFile)).rejects.toThrow();
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

    const result = await runStep16RealHostJsonlSessionV1(input);
    expect(result.receipt.events).toHaveLength(1);
  });
});
