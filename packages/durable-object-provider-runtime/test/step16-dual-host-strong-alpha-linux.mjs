import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  access,
  chown,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import {
  AlphaGoldGateEvidenceV1Schema,
  AlphaGoldTaskCorpusV1Schema,
  Step16DualHostEvidenceV1Schema,
} from "../../contracts/dist/alpha-gold.js";
import {
  deriveStep16ExpectedHostEventPlanDigestV1 as deriveContractsStep16ExpectedHostEventPlanDigestV1,
  Step16RealHostTranscriptReceiptV1Schema,
} from "../../contracts/dist/step16-host-receipts.js";
import {
  deriveStep16ExpectedHostEventPlanDigestV1 as deriveHostStep16ExpectedHostEventPlanDigestV1,
  deriveStep16RealHostActionInputDigestV1,
  runStep16RealHostJsonlSessionV1,
} from "../../host-adapters/dist/index.js";
import {
  openProviderProductionStrongObjectClientV1,
} from "@understand-code/durable-object-provider-client";

const execFileAsync = promisify(execFile);
const EXPECTED_TOOLS = Object.freeze([
  "get_repo_pulse",
  "build_task_brief",
  "get_task_brief",
  "update_task",
  "check_change",
  "record_verification",
  "open_workbench",
  "get_evidence",
  "search_context",
  "trace_impact",
  "refresh_index",
]);
const ACTOR_CODEX = "agent:step16-codex-alpha";
const ACTOR_CLAUDE = "agent:step16-claude-alpha";
const MCP_TIMEOUT_MS = 120_000;
const HOST_ACTIVATION_DIRECTORY = ".understand-code-host";
const INITIAL_SOURCE = [
  "export function step16Value(input: number): number {",
  "  return input + 1;",
  "}",
  "",
].join("\n");
const UPDATED_SOURCE = [
  "export function step16Value(input: number): number {",
  "  return input + 2;",
  "}",
  "",
].join("\n");
const VERIFICATION_COMMAND =
  "/opt/understand-code/bin/git diff --check";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

function exactJson(left, right, message) {
  assert(
    JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)),
    message,
  );
}

async function expectedHostEventPlan(host, events) {
  const orderedEvents = events.map((event, index) => Object.freeze({
    ...event,
    ordinal: index + 1,
  }));
  const hostDigest = deriveHostStep16ExpectedHostEventPlanDigestV1(
    orderedEvents,
  );
  const contractsDigest =
    await deriveContractsStep16ExpectedHostEventPlanDigestV1(orderedEvents);
  assert(
    hostDigest === contractsDigest,
    `${host} expected event plan digest differs across packages`,
  );
  return Object.freeze({
    expectedEventPlanDigest: hostDigest,
    events: Object.freeze(orderedEvents),
  });
}

async function runRealHostSession(
  input,
  host,
  prompt,
  events,
  expectedHostActionInputs = [],
) {
  const executor = input.actualHostExecutors[host];
  const result = await runStep16RealHostJsonlSessionV1({
    host,
    executable: executor.executable,
    expectedExecutableDigest: executor.executableDigest,
    cwd: input.repositoryRoot,
    prompt,
    env: executor.env,
    expectedEventPlan: await expectedHostEventPlan(host, events),
    expectedHostActionInputs,
    timeoutMs: 30 * 60 * 1_000,
  });
  assert(
    result.executableDigest === executor.executableDigest,
    `${host} executor returned another executable digest`,
  );
  return Step16RealHostTranscriptReceiptV1Schema.parse(result.receipt);
}

async function runCli(cliPath, args, options = {}) {
  const result = await execFileAsync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd,
    ...(options.childIdentity ?? {}),
    encoding: "utf8",
    env: {
      PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
      NODE_PATH: "",
    },
    maxBuffer: 4 * 1024 * 1024,
    timeout: MCP_TIMEOUT_MS,
  });
  assert(result.stderr === "", `Host lifecycle emitted stderr: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function installHost(
  cliPath,
  root,
  host,
  providerInstallationRoot,
  actualPlugin,
  childIdentity,
) {
  const result = await runCli(cliPath, [
    "install",
    "--root",
    root,
    "--host",
    host,
    "--provider-installation-root",
    providerInstallationRoot,
  ], { cwd: dirname(root), childIdentity });
  assert(result.ok === true && result.status === "installed", `${host} Host install failed`);
  const manifest = JSON.parse(
    await readFile(join(root, "installation-manifest.json"), "utf8"),
  );
  assert(manifest.host === host, `${host} manifest selected another Host`);
  assert(
    manifest.providerInstallationRoot === providerInstallationRoot,
    `${host} manifest selected another Provider installation`,
  );
  return {
    root,
    host,
    wrapper: join(root, "bin", "understand-code"),
    cli: join(root, "lib", "understand-code.mjs"),
    actualPlugin,
    childIdentity,
  };
}

async function removeHost(host) {
  const doctor = await runCli(host.cli, ["doctor", "--root", host.root], {
    cwd: dirname(host.root),
    childIdentity: host.childIdentity,
  });
  assert(doctor.ok === true && doctor.status === "healthy", `${host.host} Doctor failed`);
  const removed = await runCli(host.cli, ["uninstall", "--root", host.root], {
    cwd: dirname(host.root),
    childIdentity: host.childIdentity,
  });
  assert(removed.ok === true && removed.status === "removed", `${host.host} uninstall failed`);
  for (const ownedPath of [
    join(host.root, "installation-manifest.json"),
    join(host.root, "config", "mcp.json"),
    host.wrapper,
  ]) {
    try {
      await access(ownedPath);
      throw new Error(`${host.host} uninstall retained ${ownedPath}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function startMcpHost(host, repositoryRoot) {
  const actualPlugin = host.actualPlugin;
  assert(actualPlugin !== undefined, "installed marketplace wrapper is required");
  const env = {
    ...actualPlugin.env,
    ...(host.host === "claude"
      ? { CLAUDE_PROJECT_DIR: repositoryRoot }
      : {}),
  };
  const child = spawn(actualPlugin.executable, actualPlugin.args, {
    cwd: host.host === "codex" ? repositoryRoot : actualPlugin.cwd,
    env,
    ...(host.childIdentity ?? {}),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = new Map();
  const stderr = [];
  let nextId = 1;
  let closed = false;
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on("line", (line) => {
    if (line.trim() === "") return;
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      for (const waiter of pending.values()) waiter.reject(error);
      pending.clear();
      return;
    }
    if (message.id === undefined) return;
    const waiter = pending.get(message.id);
    if (waiter === undefined) return;
    pending.delete(message.id);
    clearTimeout(waiter.timeout);
    if (message.error !== undefined) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  });
  const closedPromise = once(child, "close").then(([code, signal]) => {
    closed = true;
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error(`MCP Host closed before response: ${code}/${signal}`));
    }
    pending.clear();
    return { code, signal };
  });
  const request = (method, params) => {
    const id = nextId++;
    const response = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, MCP_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timeout });
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return response;
  };
  const notify = (method, params) => {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  };
  return {
    host,
    child,
    stderr,
    closedPromise,
    request,
    notify,
    get closed() { return closed; },
  };
}

async function initializeHost(session) {
  const initialized = await session.request("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: `step16-${session.host.host}-alpha`, version: "1.0.0" },
  });
  assert(initialized?.serverInfo?.name === "understand-code", "MCP initialize returned another server");
  session.notify("notifications/initialized", {});
}

async function stopMcpHost(session) {
  if (!session.closed) session.child.stdin.end();
  const closed = await session.closedPromise;
  assert(closed.code === 0 && closed.signal === null, `${session.host.host} MCP did not close cleanly`);
  assert(session.stderr.join("") === "", `${session.host.host} MCP emitted stderr`);
}

async function listTools(session) {
  const result = await session.request("tools/list", {});
  const names = result?.tools?.map((tool) => tool.name);
  exactJson(names, EXPECTED_TOOLS, `${session.host.host} did not advertise the exact 11-tool surface`);
  assert(
    result.tools.every((tool) => tool.inputSchema !== undefined && tool.outputSchema !== undefined),
    `${session.host.host} advertised an unversioned tool contract`,
  );
}

async function callTool(session, name, argumentsValue) {
  const result = await session.request("tools/call", {
    name,
    arguments: argumentsValue,
  });
  if (result?.isError === true) {
    throw new Error(`${session.host.host}:${name}:${JSON.stringify(result.structuredContent?.error)}`);
  }
  assert(
    result?.structuredContent?.schemaVersion === 1,
    `${session.host.host}:${name} omitted its versioned structured result`,
  );
  return result;
}

async function initializeRepository(repositoryRoot, childIdentity) {
  await mkdir(repositoryRoot, { recursive: true, mode: 0o700 });
  await mkdir(join(repositoryRoot, "src"), { mode: 0o700 });
  await writeFile(
    join(repositoryRoot, "src", "task.ts"),
    INITIAL_SOURCE,
    { mode: 0o600 },
  );
  if (childIdentity !== undefined) {
    for (const path of [repositoryRoot, join(repositoryRoot, "src"), join(repositoryRoot, "src", "task.ts")]) await chown(path, childIdentity.uid, childIdentity.gid);
  }
  await execFileAsync("/opt/understand-code/bin/git", ["init", "--quiet", repositoryRoot], childIdentity);
  await execFileAsync("/opt/understand-code/bin/git", ["-C", repositoryRoot, "add", "--", "src/task.ts"], childIdentity);
  await execFileAsync("/opt/understand-code/bin/git", [
    "-C",
    repositoryRoot,
    "-c",
    "user.name=Step16 Alpha",
    "-c",
    "user.email=step16@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "step16 alpha fixture",
  ], childIdentity);
}

async function verifyRootFailure(host, invalidRoot) {
  const session = startMcpHost(host, invalidRoot);
  try {
    await initializeHost(session);
    await listTools(session);
    const result = await session.request("tools/call", {
      name: "get_repo_pulse",
      arguments: {},
    });
    assert(result?.isError === true, "invalid workspace Root unexpectedly reached a repository tool");
    exactJson(
      result.structuredContent?.error,
      {
        schemaVersion: 1,
        code: "workspace_binding_required",
        details: { reason: "root_unavailable" },
      },
      "invalid workspace Root did not fail closed",
    );
  } finally {
    await stopMcpHost(session);
  }
  try {
    await access(join(invalidRoot, ".understand-code"));
    throw new Error("invalid workspace Root received an artifact Store");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function updateTask(session, state, action, key) {
  const output = await callTool(session, "update_task", {
    taskId: state.taskId,
    action,
    expectedRevision: state.revision,
    idempotencyKey: key,
    actor: state.actor,
  });
  const result = output.structuredContent.result;
  state.revision = result.task.revision;
  state.task = result.task;
  return result;
}

async function readTaskSummary(session, taskId) {
  const output = await callTool(session, "get_task_brief", {
    taskId,
    section: "summary",
    pageSize: 50,
  });
  return output.structuredContent.result;
}

async function readEvidence(session, taskId, evidenceIds) {
  const output = await callTool(session, "get_evidence", {
    taskId,
    evidenceIds,
    pageSize: 200,
  });
  return output.structuredContent.result;
}

async function loadCorpus(corpusPath) {
  const bytes = await readFile(corpusPath);
  const corpus = AlphaGoldTaskCorpusV1Schema.parse(
    JSON.parse(bytes.toString("utf8")),
  );
  return {
    corpus,
    digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  };
}

function blockedGoldGateEvidence(
  corpus,
  corpusManifestDigest,
  syntheticStatus,
) {
  return AlphaGoldGateEvidenceV1Schema.parse({
    schemaVersion: 1,
    profile: "alpha_gold_gate_evidence_v1",
    corpusManifestDigest,
    generatedAt: new Date().toISOString(),
    taskDefinitionStatus: "blocked_not_versioned",
    syntheticVertical: {
      status: syntheticStatus,
      countsTowardG2OrG3: false,
      executionSurface: "installed_wrapper_stdio",
      hostAuthority: "trusted_installation_wrappers_only",
      hosts: ["codex", "claude"],
      toolCount: 11,
    },
    sources: {
      alphaA: {
        revision: corpus.sources.alphaA.revision,
        materializableFromRepository: false,
      },
      alphaB: {
        revision: corpus.sources.alphaB.revision,
        ownerAuthorizationObserved: false,
        localCorpusAvailable: false,
        copiedIntoRepository: false,
      },
    },
    hostRuns: {
      codex: {
        status: "blocked",
        requiredTasks: 24,
        passedTasks: 0,
        alphaAPassedTasks: 0,
        alphaBPassedTasks: 0,
      },
      claude: {
        status: "blocked",
        requiredTasks: 24,
        passedTasks: 0,
        alphaAPassedTasks: 0,
        alphaBPassedTasks: 0,
      },
    },
    g2: {
      status: "blocked",
      requiredPassedTasks: 12,
      blockers: [
        "gold_task_definitions_not_versioned",
        "alpha_b_owner_authorization_missing",
      ],
    },
    g3: {
      status: "blocked",
      requiredGoldTasksPerHost: 24,
      requiredHostTaskExecutions: 48,
      artifactTaskRevisionIdentityMatched: false,
      blockers: [
        "gold_task_definitions_not_versioned",
        "alpha_a_not_executed",
        "alpha_b_owner_authorization_missing",
        "codex_gold_incomplete",
        "claude_gold_incomplete",
      ],
    },
  });
}

export async function createStep16DualHostBlockedEvidenceV1(input) {
  const { corpus, digest } = await loadCorpus(input.corpusPath);
  return Step16DualHostEvidenceV1Schema.parse({
    schemaVersion: 1,
    profile: "step16_dual_host_strong_alpha_linux_v1",
    status: "blocked",
    hosts: ["codex", "claude"],
    hostExecution: {
      status: "blocked",
      blocker: input.blocker,
    },
    syntheticVertical: {
      status: "failed",
      executionSurface: "installed_wrapper_stdio",
      hostAuthority: "trusted_installation_wrappers_only",
    },
    toolCount: EXPECTED_TOOLS.length,
    rootFailClosed: "not_run",
    externalSourceMutation: "not_run",
    sharedArtifacts: "not_run",
    lifecycle: "not_run",
    goldGate: blockedGoldGateEvidence(corpus, digest, "failed"),
  });
}

/** Root-owned execution path. Every task action is a real Host CLI session;
 * no callTool driver or Host-authored result/plan crosses this boundary. */
export async function runStep16RootOwnedStrongAlphaV1(input) {
  assert(process.platform === "linux" && process.geteuid?.() === 0 && process.getegid?.() === 0, "Step16 root supervisor is required");
  const {
    step16FixedWorkflowStagesV1, step16FixedStageArgumentsV1,
    step16ArgumentsDigestV1, verifyStep16FixedStageCommitV1,
    readStep16FixedFinalTaskV1, STEP16_INITIAL_SOURCE_V1,
    STEP16_UPDATED_SOURCE_V1, STEP16_EXPECTED_BLOCKING_FINDINGS_V1,
    createStep16RootMcpLaunchersV1,
  } = await import("./step16-root-fixed-workflow-linux.mjs");
  const { createStep16HostCallSupervisorInternalV1 } = await import("../../host-adapters/dist/step16-host-call-supervisor-internal.js");
  const { connectStep16HostCallWitnessClientInternalV1 } = await import("../../durable-object-provider-authority/dist/step16-host-call-witness-client-internal.js");
  const { startStep16ProviderOperationPlanRelayInternalV1 } = await import("../../durable-object-provider-authority/dist/step16-provider-operation-plan-relay-internal.js");
  const { openProviderProductionStrongObjectHostInternalV1 } = await import("../../durable-object-provider-client/dist/provider-production-strong-object-client.js");
  const { Step16ProviderReceiptBindingV1Schema } = await import("../../contracts/dist/step16-host-receipts.js");
  const childIdentity = Object.freeze({ uid: input.callerUid, gid: input.callerGid });
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 60 * 60 * 1000);
  deadline.unref();
  const provider = await openProviderProductionStrongObjectHostInternalV1({ canonicalInstallationRoot: input.providerInstallationRoot });
  let connecting;
  const connect = () => connecting ??= connectStep16HostCallWitnessClientInternalV1({
    socketPath: input.witnessSocketPath, expectedAuthorityPid: input.authorityPid,
    runNonce: input.closingPlan.runNonce, closingPlanDigest: input.closingPlan.closingPlanDigest,
    signal: controller.signal, timeoutMs: 60_000,
  });
  const witnessClient = Object.fromEntries(["arm", "armDerived", "observe", "complete", "finalize"].map((name) => [name, async (...args) => (await connect())[name](...args)]));
  witnessClient.close = async () => { if (connecting !== undefined) await (await connecting).close(); };
  const supervisor = createStep16HostCallSupervisorInternalV1({ closingPlan: input.closingPlan, witnessClient, signal: controller.signal, operationWaitMs: 60_000 });
  const installed = [];
  const executions = [];
  const preflights = [];
  let relay;
  try {
    relay = await startStep16ProviderOperationPlanRelayInternalV1({
      socketPath: input.relaySocketPath, expectedGatewayPeer: input.gatewayPeer,
      runNonce: input.closingPlan.runNonce, closingPlanDigest: input.closingPlan.closingPlanDigest,
      observeProviderOperation: supervisor.observeProviderOperation, timeoutMs: 60_000,
    });
    await initializeRepository(input.repositoryRoot, childIdentity);
    const rootMcpServers = await createStep16RootMcpLaunchersV1(join(dirname(dirname(input.relaySocketPath)), "step16-mcp-launchers"), input.actualHostPlugins, input.repositoryRoot, childIdentity);
    for (const host of ["codex", "claude"]) {
      const plugin = input.actualHostPlugins[host];
      const installation = await installHost(plugin.cliPath, join(plugin.installedRoot, HOST_ACTIVATION_DIRECTORY), host, input.providerInstallationRoot, plugin, childIdentity);
      installed.push(installation);
      // This is only an installed-wrapper protocol preflight. It performs no
      // repository tool call and contributes no Agent/Task evidence.
      const server = rootMcpServers[host];
      const probe = startMcpHost({ ...installation, actualPlugin: { ...plugin, executable: server.command, args: server.args, env: server.env } }, input.repositoryRoot);
      try {
        await initializeHost(probe);
        await listTools(probe);
        const leafProcs = "/sys/fs/cgroup/understand-code-step16-caller-v1/safe-git/understand-code-safe-git-supervisor-v1/cgroup.procs";
        assert((await readFile(leafProcs, "utf8")).trim() === String(probe.child.pid), "installed MCP CLI is not the sole SafeGit leaf process");
        const argv = (await readFile(`/proc/${probe.child.pid}/cmdline`, "utf8")).split("\0").filter((value) => value !== "");
        exactJson(argv.slice(1), [plugin.cliPath, "mcp", "--stdio", "--root", input.repositoryRoot, "--installation-root", installation.root], "MCP launcher did not exec the actual installed CLI");
        assert((await readFile(leafProcs, "utf8")).trim() === String(probe.child.pid), "SafeGit leaf membership changed during inspection");
        preflights.push({ host, actualCliPath: plugin.cliPath, singlePid: true, protocol: "initialize_and_tools_list_only", advertisedTools: EXPECTED_TOOLS.length });
      }
      finally { await stopMcpHost(probe); }
    }
    if (input.preflightOnly === true) return {
      schemaVersion: 1, profile: "step16_root_supervised_fixed_workflow_v1", status: "preflight_verified",
      countsTowardG2OrG3: false, modelInvoked: false, businessToolsInvoked: false, preflights,
    };
    const context = { repositoryRoot: input.repositoryRoot, provider };
    for (const stage of step16FixedWorkflowStagesV1()) {
      const args = await step16FixedStageArgumentsV1(stage, context);
      const event = stage.kind === "mcp_tool_call"
        ? { kind: "mcp_tool_call", server: "understand-code", tool: stage.tool }
        : { kind: "host_action", action: stage.action, mechanism: stage.mechanism, inputDigest: deriveStep16RealHostActionInputDigestV1(args) };
      const executor = input.actualHostExecutors[stage.host];
      const instruction = stage.kind === "mcp_tool_call"
        ? `Call the understand-code MCP tool ${stage.tool} exactly once with this exact JSON input: ${JSON.stringify(args)}.`
        : stage.id === "source"
        ? `Use the native apply_patch tool exactly once to update src/task.ts from ${JSON.stringify(STEP16_INITIAL_SOURCE_V1)} to ${JSON.stringify(STEP16_UPDATED_SOURCE_V1)}. Use the relative patch path src/task.ts, with no other file changes.`
        : `Call Bash exactly once with this exact JSON input: ${JSON.stringify(args)}.`;
      const execution = await supervisor.run({
        host: stage.host, executable: executor.executable, expectedExecutableDigest: executor.executableDigest,
        cwd: input.repositoryRoot, env: executor.env,
        prompt: `This is stage ${stage.eventOrdinal} of one fixed, root-supervised synthetic workflow.\n${instruction}\nDo not call any other tool. Do not inspect files with tools first. Stop after this operation succeeds.`,
        expectedEventPlan: await expectedHostEventPlan(stage.host, [event]),
        expectedHostActionInputs: stage.kind === "host_action" ? [{ ordinal: 1, input: args }] : [],
        timeoutMs: 30 * 60 * 1000,
      }, { childIdentity, ...(stage.id === "source" ? { codexSourceMutation: { beforeContent: STEP16_INITIAL_SOURCE_V1, afterContent: STEP16_UPDATED_SOURCE_V1 } } : { rootMcpServer: rootMcpServers[stage.host] }) });
      const receipt = Step16RealHostTranscriptReceiptV1Schema.parse(execution.receipt);
      const observed = receipt.events[0];
      assert(receipt.events.length === 1 && (stage.kind !== "mcp_tool_call" || observed.argumentsDigest === step16ArgumentsDigestV1(args)), "real Host executed another exact stage input");
      await verifyStep16FixedStageCommitV1(stage, args, context);
      executions.push({ eventOrdinal: stage.eventOrdinal, stage: stage.id, receipt, rawTranscriptDigest: execution.rawTranscriptDigest, executableDigest: execution.executableDigest, ...(execution.sourceMutation === undefined ? {} : { sourceMutation: execution.sourceMutation }) });
    }
    const finalTask = await readStep16FixedFinalTaskV1(input.repositoryRoot);
    const completion = await supervisor.finalize();
    assert(completion !== null && typeof completion === "object" && Array.isArray(completion.strongCallProviderReceipts) && Array.isArray(completion.providerBindings), "invalid witness finalization");
    assert(completion.strongCallProviderReceipts.length === input.closingPlan.calls.length, "witness did not finalize N/N calls");
    const providerBindings = completion.providerBindings.map((binding) => Step16ProviderReceiptBindingV1Schema.parse(binding));
    for (const [index, call] of input.closingPlan.calls.entries()) {
      const actual = executions.find((execution) => execution.eventOrdinal === call.eventOrdinal).receipt;
      const completed = completion.strongCallProviderReceipts[index];
      assert(completed.callIdDigest === actual.events[0].callIdDigest, "witness finalized another observed call");
      exactJson(providerBindings.filter((binding) => binding.callIdDigest === completed.callIdDigest).map((binding) => binding.receiptLedger.receiptBundleDigest), completed.receiptBundleDigests, "Provider bindings differ from the finalized call");
    }
    return {
      schemaVersion: 1, profile: "step16_root_supervised_fixed_workflow_v1", status: "verified_not_gold",
      countsTowardG2OrG3: false, executionSurface: "real_host_cli_jsonl", ...finalTask,
      providerRevision: (await provider.inspectState()).revision,
      closingPlan: input.closingPlan, completedCalls: completion.strongCallProviderReceipts.length,
      expectedBlockingFindingCount: STEP16_EXPECTED_BLOCKING_FINDINGS_V1,
      strongCallProviderReceipts: completion.strongCallProviderReceipts, providerBindings, executions,
      limitation: "Fixed synthetic fixture with separate real Host sessions; not a full Gold task or a single-session claim.",
    };
  } finally {
    clearTimeout(deadline);
    controller.abort();
    await relay?.close().catch(() => undefined);
    await supervisor.close();
    provider.close();
    for (const host of installed.reverse()) await removeHost(host);
  }
}

export async function runStep16DualHostStrongAlphaV1(input) {
  assert(process.platform === "linux", "Step16 dual-Host strong Alpha requires Linux");
  assert(process.geteuid?.() === input.callerUid, "Step16 dual-Host role must run as the caller principal");
  assert(
    input.verifiedTaskObserver === undefined ||
      typeof input.verifiedTaskObserver === "function",
    "Step16 verified Task observer must be a function",
  );
  const pinnedGit = await stat("/opt/understand-code/bin/git");
  assert(
    pinnedGit.isFile() && pinnedGit.uid === 0 && pinnedGit.gid === 0 &&
      (pinnedGit.mode & 0o7777) === 0o755 && pinnedGit.nlink === 1,
    "Step16 production SafeGit executable is not pinned",
  );
  const cgroup = await readFile("/proc/self/cgroup", "utf8");
  assert(
    cgroup.trim().split("\n").some((line) =>
      line.startsWith("0::/") &&
      line.split("/").at(-1) === "understand-code-safe-git-supervisor-v1"
    ),
    "Step16 MCP caller is outside the delegated SafeGit cgroup",
  );

  const { corpus, digest: corpusManifestDigest } = await loadCorpus(input.corpusPath);
  await initializeRepository(input.repositoryRoot);
  await mkdir(input.invalidRoot, { recursive: true, mode: 0o700 });
  const actualHostPlugins = input.actualHostPlugins;
  assert(
    actualHostPlugins?.codex !== undefined &&
      actualHostPlugins?.claude !== undefined,
    "Step16 actual Host profile requires both installed plugins",
  );
  assert(
    actualHostPlugins.codex.installedRoot !==
      actualHostPlugins.claude.installedRoot,
    "Step16 Codex and Claude plugins must be independent installations",
  );
  const actualHostExecutors = input.actualHostExecutors;
  assert(
    actualHostExecutors?.codex !== undefined &&
      actualHostExecutors?.claude !== undefined &&
      typeof actualHostExecutors.codex.executable === "string" &&
      typeof actualHostExecutors.claude.executable === "string" &&
      typeof actualHostExecutors.codex.executableDigest === "string" &&
      typeof actualHostExecutors.claude.executableDigest === "string" &&
      /^sha256:[0-9a-f]{64}$/u.test(
        actualHostExecutors.codex.executableDigest,
      ) &&
      /^sha256:[0-9a-f]{64}$/u.test(
        actualHostExecutors.claude.executableDigest,
      ) &&
      actualHostExecutors.codex.env !== undefined &&
      actualHostExecutors.claude.env !== undefined,
    "Step16 real Host executors require Codex and Claude CLI capabilities",
  );
  const codexRoot = join(
    actualHostPlugins.codex.installedRoot,
    HOST_ACTIVATION_DIRECTORY,
  );
  const claudeRoot = join(
    actualHostPlugins.claude.installedRoot,
    HOST_ACTIVATION_DIRECTORY,
  );
  let codex;
  let claude;
  let codexSession;
  let claudeSession;
  let codexHostTranscriptReceipt;
  let claudeSourceTranscriptReceipt;
  let claudeVerificationTranscriptReceipt;
  const lifecycle = [];
  try {
    codex = await installHost(
      actualHostPlugins.codex.cliPath,
      codexRoot,
      "codex",
      input.providerInstallationRoot,
      actualHostPlugins.codex,
    );
    lifecycle.push(codex);
    claude = await installHost(
      actualHostPlugins.claude.cliPath,
      claudeRoot,
      "claude",
      input.providerInstallationRoot,
      actualHostPlugins.claude,
    );
    lifecycle.push(claude);
    assert(codex.root !== claude.root, "dual Host installations share one owned root");
    await verifyRootFailure(codex, input.invalidRoot);
    await verifyRootFailure(claude, input.invalidRoot);

    codexSession = startMcpHost(codex, input.repositoryRoot);
    await initializeHost(codexSession);
    await listTools(codexSession);
    const initialRefresh = await callTool(codexSession, "refresh_index", {
      mode: "full",
      idempotencyKey: "step16-codex-initial-refresh",
      actor: ACTOR_CODEX,
    });
    const initialSnapshotId =
      initialRefresh.structuredContent.result.operation.finalSnapshotId;
    const builtOutput = await callTool(codexSession, "build_task_brief", {
      task: "Synthetic Step16 Provider vertical: update the fixture value and verify the exact change.",
      expectedRevision: 0,
      idempotencyKey: "step16-codex-build-task",
      actor: ACTOR_CODEX,
      scope: ["src/task.ts"],
      tokenBudget: 8_000,
      maxCandidates: 20,
      maxImpactDepth: 4,
    });
    const built = builtOutput.structuredContent.result;
    assert(
      built.task.latestSnapshotId === initialSnapshotId,
      "Task Brief did not bind the initial strong Snapshot",
    );
    const state = {
      actor: ACTOR_CODEX,
      taskId: built.task.taskId,
      revision: built.task.revision,
      task: built.task,
    };
    const contextGenerationId = built.brief.contextGenerationId;
    await updateTask(codexSession, state, {
      type: "confirm_goal",
      claimId: built.brief.goalClaimId,
      contextGenerationId,
    }, "step16-codex-confirm-goal");
    await updateTask(codexSession, state, {
      type: "confirm_acceptance_criteria",
      claimIds: built.brief.acceptanceClaimIds,
      contextGenerationId,
    }, "step16-codex-confirm-acceptance");
    await updateTask(codexSession, state, {
      type: "confirm_plan",
      plannedChangeIds: built.brief.plannedChanges.map((item) => item.id),
      contextGenerationId,
    }, "step16-codex-confirm-plan");
    await updateTask(codexSession, state, {
      type: "transition_status",
      to: "planned",
    }, "step16-codex-planned");
    await updateTask(codexSession, state, {
      type: "transition_status",
      to: "in_progress",
    }, "step16-codex-in-progress");
    const codexTaskBeforeHandoff = structuredClone(state.task);
    await stopMcpHost(codexSession);
    codexSession = undefined;

    const taskBriefArguments = Object.freeze({
      taskId: state.taskId,
      section: "summary",
      pageSize: 50,
    });
    codexHostTranscriptReceipt = await runRealHostSession(
      input,
      "codex",
      [
        "This is a fixed Step16 closing-gate observation.",
        `Call the understand-code MCP tool get_task_brief exactly once with this exact JSON input: ${JSON.stringify(taskBriefArguments)}.`,
        "Do not call any other tool, do not modify files, and stop after the successful result.",
      ].join("\n"),
      [{
        kind: "mcp_tool_call",
        server: "understand-code",
        tool: "get_task_brief",
      }],
    );

    const sourceActionInput = Object.freeze({
      file_path: join(input.repositoryRoot, "src", "task.ts"),
      content: UPDATED_SOURCE,
    });
    claudeSourceTranscriptReceipt = await runRealHostSession(
      input,
      "claude",
      [
        "This is a fixed Step16 closing-gate source mutation.",
        `First call mcp__understand-code__get_task_brief exactly once with this exact JSON input: ${JSON.stringify(taskBriefArguments)}.`,
        `Then call Write exactly once with this exact JSON input: ${JSON.stringify(sourceActionInput)}.`,
        "Do not call any other tool and stop after Write succeeds.",
      ].join("\n"),
      [
        {
          kind: "mcp_tool_call",
          server: "understand-code",
          tool: "get_task_brief",
        },
        {
          kind: "host_action",
          action: "source_mutation",
          mechanism: "file_change",
          inputDigest:
            deriveStep16RealHostActionInputDigestV1(sourceActionInput),
        },
      ],
      [{ ordinal: 2, input: sourceActionInput }],
    );
    assert(
      await readFile(join(input.repositoryRoot, "src", "task.ts"), "utf8") ===
        UPDATED_SOURCE,
      "real Claude source mutation did not produce the exact Step16 fixture",
    );

    claudeSession = startMcpHost(claude, input.repositoryRoot);
    await initializeHost(claudeSession);
    await listTools(claudeSession);
    const handedOff = await readTaskSummary(claudeSession, state.taskId);
    exactJson(
      handedOff.task,
      codexTaskBeforeHandoff,
      "Claude did not continue the exact Codex Task revision",
    );
    state.actor = ACTOR_CLAUDE;

    const actualRefresh = await callTool(claudeSession, "refresh_index", {
      mode: "incremental",
      expectedSourceSnapshotId: initialSnapshotId,
      idempotencyKey: "step16-claude-actual-refresh",
      actor: ACTOR_CLAUDE,
    });
    const actualSnapshotId =
      actualRefresh.structuredContent.result.operation.finalSnapshotId;
    assert(actualSnapshotId !== initialSnapshotId, "external source change reused the baseline Snapshot ID");
    await updateTask(claudeSession, state, {
      type: "transition_status",
      to: "check_required",
    }, "step16-claude-check-required");
    const checkOutput = await callTool(claudeSession, "check_change", {
      profile: "check_changes_strong_v1",
      taskId: state.taskId,
      actualSnapshotId,
      includeWorktree: true,
      expectedRevision: state.revision,
      idempotencyKey: "step16-claude-check-change",
      actor: ACTOR_CLAUDE,
    });
    const checked = checkOutput.structuredContent.result;
    state.revision = checked.committedRevision;
    const evidenceIds = checked.evidence.map((evidence) => evidence.id).sort();
    assert(evidenceIds.length > 0, "strong Change Check emitted no evidence");
    const browserEvidenceCandidates = checked.evidence.filter((evidence) =>
      evidence.kind === "diff_hunk" &&
      evidence.filePath === "src/task.ts" &&
      evidence.observedAtSnapshotId === actualSnapshotId
    );
    assert(
      browserEvidenceCandidates.length === 1,
      "strong Change Check must emit one current src/task.ts diff Evidence",
    );
    const browserEvidence = browserEvidenceCandidates[0];
    const browserFinding = [...checked.changeCheck.findings]
      .filter((finding) => finding.evidenceIds.includes(browserEvidence.id))
      .sort((left, right) => left.id.localeCompare(right.id, "en"))[0];
    assert(
      browserFinding !== undefined,
      "strong Change Check diff Evidence must belong to a Finding",
    );
    for (const finding of checked.changeCheck.findings.filter((entry) => entry.blocking)) {
      await updateTask(claudeSession, state, {
        type: "accept_finding",
        findingId: finding.id,
        reason: "Step16 synthetic Alpha explicitly accepts this observed finding.",
      }, `step16-claude-accept-${finding.id}`);
    }
    await updateTask(claudeSession, state, {
      type: "transition_status",
      to: "verification_required",
    }, "step16-claude-verification-required");

    await stopMcpHost(claudeSession);
    claudeSession = undefined;
    const verificationStartedAt = Date.now();
    const verificationActionInput = Object.freeze({
      command: VERIFICATION_COMMAND,
    });
    claudeVerificationTranscriptReceipt = await runRealHostSession(
      input,
      "claude",
      [
        "This is a fixed Step16 closing-gate verification.",
        `First call mcp__understand-code__get_task_brief exactly once with this exact JSON input: ${JSON.stringify(taskBriefArguments)}.`,
        `Then call Bash exactly once with this exact JSON input: ${JSON.stringify(verificationActionInput)}.`,
        "Do not call any other tool and stop after Bash succeeds.",
      ].join("\n"),
      [
        {
          kind: "mcp_tool_call",
          server: "understand-code",
          tool: "get_task_brief",
        },
        {
          kind: "host_action",
          action: "verification",
          mechanism: "command_execution",
          inputDigest:
            deriveStep16RealHostActionInputDigestV1(verificationActionInput),
        },
      ],
      [{ ordinal: 2, input: verificationActionInput }],
    );
    const verificationDurationMs = Math.max(0, Date.now() - verificationStartedAt);
    claudeSession = startMcpHost(claude, input.repositoryRoot);
    await initializeHost(claudeSession);
    const planEntry = built.brief.verificationPlan[0];
    assert(planEntry !== undefined, "Task Brief emitted no verification plan");
    const verificationInput = {
      profile: "record_verification_strong_v1",
      taskId: state.taskId,
      snapshotId: actualSnapshotId,
      verificationPlanEntryId: planEntry.id,
      method: planEntry.method,
      status: "passed",
      claimIds: [...planEntry.acceptanceClaimIds].sort(),
      ...(planEntry.method === "manual" ? {} : {
        command: {
          executable: "/opt/understand-code/bin/git",
          arguments: ["diff", "--check"],
          workingDirectory: "repository_root",
          environmentKeys: [],
        },
        exitCode: 0,
        durationMs: verificationDurationMs,
      }),
      summary: "Externally executed repository diff validation passed.",
      expectedRevision: state.revision,
      idempotencyKey: "step16-claude-record-verification",
      actor: ACTOR_CLAUDE,
    };
    const verificationOutput = await callTool(
      claudeSession,
      "record_verification",
      verificationInput,
    );
    const verification = verificationOutput.structuredContent.result;
    state.revision = verification.committedRevision;
    await updateTask(claudeSession, state, {
      type: "transition_status",
      to: "verified",
    }, "step16-claude-verified");
    const claudeFinalTask = await readTaskSummary(claudeSession, state.taskId);
    const claudeEvidence = await readEvidence(
      claudeSession,
      state.taskId,
      evidenceIds,
    );
    const claudePulse = (await callTool(claudeSession, "get_repo_pulse", {}))
      .structuredContent.result;
    await stopMcpHost(claudeSession);
    claudeSession = undefined;

    codexSession = startMcpHost(codex, input.repositoryRoot);
    await initializeHost(codexSession);
    const codexFinalTask = await readTaskSummary(codexSession, state.taskId);
    const codexEvidence = await readEvidence(codexSession, state.taskId, evidenceIds);
    const codexPulse = (await callTool(codexSession, "get_repo_pulse", {}))
      .structuredContent.result;
    exactJson(codexFinalTask, claudeFinalTask, "dual Hosts returned different final Task artifacts");
    exactJson(codexEvidence, claudeEvidence, "dual Hosts returned different Evidence artifacts");
    exactJson(codexPulse, claudePulse, "dual Hosts returned different Repository Pulse artifacts");
    assert(codexFinalTask.task.status === "verified", "final shared Task is not verified");
    if (input.verifiedTaskObserver !== undefined) {
      const evidenceId = browserEvidence.id;
      const opened = await callTool(codexSession, "open_workbench", {
        route: {
          view: "tasks",
          taskId: state.taskId,
          section: "planned_changes",
          findingId: browserFinding.id,
        },
        openBrowser: false,
      });
      assert(
        opened.structuredContent.meta.sourceSnapshotId === actualSnapshotId,
        "Provider-backed Workbench bound another Snapshot",
      );
      assert(
        opened.structuredContent.result.route.taskId === state.taskId &&
          opened.structuredContent.result.route.findingId === browserFinding.id,
        "Provider-backed Workbench returned another Task route",
      );
      await input.verifiedTaskObserver(Object.freeze({
        deepLink: opened.structuredContent.result.deepLink,
        taskId: state.taskId,
        findingId: browserFinding.id,
        evidenceId,
        actualSnapshotId,
        taskRevision: codexFinalTask.task.revision,
      }));
    }
    await stopMcpHost(codexSession);
    codexSession = undefined;

    const providerClient = await openProviderProductionStrongObjectClientV1({
      canonicalInstallationRoot: input.providerInstallationRoot,
    });
    let providerRevision;
    try {
      providerRevision = (await providerClient.inspectState()).revision;
    } finally {
      await providerClient.close();
    }
    const gateEvidence = blockedGoldGateEvidence(
      corpus,
      corpusManifestDigest,
      "verified",
    );
    return Step16DualHostEvidenceV1Schema.parse({
      schemaVersion: 1,
      profile: "step16_dual_host_strong_alpha_linux_v1",
      status: "blocked",
      hosts: ["codex", "claude"],
      hostExecution: {
        status: "verified_not_gold",
        executionSurface: "real_host_cli_jsonl",
        providerReceiptBinding: "not_bound",
        transcriptReceipts: {
          codex: codexHostTranscriptReceipt,
          claude: [
            claudeSourceTranscriptReceipt,
            claudeVerificationTranscriptReceipt,
          ],
        },
      },
      syntheticVertical: {
        status: "verified",
        executionSurface: "installed_wrapper_stdio",
        hostAuthority: "trusted_installation_wrappers_only",
        independentInstallations: true,
        providerBinding: "self_relative_owned_activation",
        ambientSelection: "poisoned_environment_ignored",
      },
      toolCount: EXPECTED_TOOLS.length,
      rootFailClosed: "verified_both_hosts_zero_write",
      externalSourceMutation: "verified",
      taskId: state.taskId,
      taskRevision: codexFinalTask.task.revision,
      taskStatus: codexFinalTask.task.status,
      baselineSnapshotId: initialSnapshotId,
      actualSnapshotId,
      evidenceCount: evidenceIds.length,
      providerRevision,
      sharedArtifacts: "byte_equivalent_public_results",
      lifecycle: "marketplace_installed_selector_verified_clean_close",
      goldGate: gateEvidence,
    });
  } finally {
    const cleanupErrors = [];
    for (const session of [codexSession, claudeSession]) {
      if (session === undefined || session.closed) continue;
      session.child.kill("SIGTERM");
      await session.closedPromise.catch(() => undefined);
    }
    for (const host of lifecycle.reverse()) {
      try {
        await removeHost(host);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    for (const root of [input.invalidRoot, input.repositoryRoot]) {
      try {
        await rm(root, { recursive: true, force: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, "Step16 Host activation cleanup failed");
    }
  }
}
