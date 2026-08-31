// Private, fixed synthetic fixture recipe. This is not a Gold task/oracle and
// never accepts a Host-authored plan or uses an MCP result as authority.
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { chown, chmod, lstat, mkdir, open, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";

export const STEP16_INITIAL_SOURCE_V1 = "export function step16Value(input: number): number {\n  return input + 1;\n}\n";
export const STEP16_UPDATED_SOURCE_V1 = "export function step16Value(input: number): number {\n  return input + 2;\n}\n";
export const STEP16_TASK_INTENT_V1 = "Synthetic Step16 Provider vertical: update the fixture value and verify the exact change.";
export const STEP16_VERIFICATION_COMMAND_V1 = "/opt/understand-code/bin/git diff --check";
// This is an explicit fixture assertion, not a prediction of future IDs. A
// different actual count rejects the run before its next side effect.
export const STEP16_EXPECTED_BLOCKING_FINDINGS_V1 = 1;
const CODEX_ACTOR = "agent:step16-codex-alpha";
const CLAUDE_ACTOR = "agent:step16-claude-alpha";
const DIGEST = /^sha256:[0-9a-f]{64}$/u;

function assert(value, message) { if (!value) throw new Error(message); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
  );
  return value;
}
export function step16ArgumentsDigestV1(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`;
}
function exactKeys(value, keys) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), "invalid root workflow profile shape");
}
function absolute(value) {
  assert(typeof value === "string" && isAbsolute(value) && resolve(value) === value && !/[\u0000-\u001f\u007f]/u.test(value), "noncanonical root workflow path");
  return value;
}

export function requireStep16AuthorityReadyV1(value, authorityPid, preflightOnly) {
  exactKeys(value, ["authorityPid", "mode", "witness"]);
  assert(Number.isSafeInteger(authorityPid) && authorityPid > 1 && typeof preflightOnly === "boolean" &&
    value.authorityPid === authorityPid && value.mode === (preflightOnly ? "preflight_only" : "witness") &&
    value.witness === (preflightOnly ? "not_started" : "listening"), "Step16 authority readiness does not match the pinned process and mode");
  return value;
}

export async function closeStep16AuthorityServicesV1(witnessServer, service) {
  const failures = [];
  for (const opened of [witnessServer, service]) {
    if (opened === undefined) continue;
    try { await opened.close(); } catch (error) { failures.push(error); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "Step16 authority cleanup failed");
}

export function waitForSuccessfulAuthorityExitV1(child) {
  return new Promise((resolvePromise, rejectPromise) => {
    const finish = (code, signal) => {
      child.off("error", failed);
      child.off("exit", finish);
      if (code === 0 && signal === null) resolvePromise();
      else rejectPromise(new Error(`authority exited unsuccessfully: code=${code}, signal=${signal}`));
    };
    const failed = (error) => {
      child.off("exit", finish);
      rejectPromise(error);
    };
    if (child.exitCode !== null || child.signalCode !== null) finish(child.exitCode, child.signalCode);
    else {
      child.once("error", failed);
      child.once("exit", finish);
    }
  });
}

export async function readStep16RootControlJsonV1(path) {
  absolute(path);
  assert(process.geteuid?.() === 0 && process.getegid?.() === 0, "root workflow reader requires root");
  for (let parent = dirname(path); ; parent = dirname(parent)) {
    const metadata = await lstat(parent);
    const safeStickyAncestor = parent !== dirname(path) && (metadata.mode & 0o1000) !== 0;
    assert(metadata.isDirectory() && !metadata.isSymbolicLink() && metadata.uid === 0 && ((metadata.mode & 0o022) === 0 || safeStickyAncestor), "unsafe root workflow parent");
    if (dirname(parent) === parent) break;
  }
  assert(await realpath(path) === path, "linked root workflow profile");
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat();
    assert(before.isFile() && before.nlink === 1 && before.uid === 0 && before.gid === 0 && (before.mode & 0o7777) === 0o600 && before.size <= 1024 * 1024, "unsafe root workflow file");
    const bytes = Buffer.alloc(before.size + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const after = await handle.stat();
    assert(bytesRead === before.size && after.size === before.size && after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs, "root workflow profile changed");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, bytesRead)));
  } finally { await handle.close(); }
}

export async function readStep16RootHostProfileV1(path) {
  const profile = await readStep16RootControlJsonV1(path);
  exactKeys(profile, ["schemaVersion", "profile", "actualHostExecutors", "actualHostPlugins"]);
  assert(profile.schemaVersion === 1 && profile.profile === "step16_root_host_profile_v1", "unsupported root Host profile");
  exactKeys(profile.actualHostExecutors, ["codex", "claude"]);
  exactKeys(profile.actualHostPlugins, ["codex", "claude"]);
  for (const host of ["codex", "claude"]) {
    const executor = profile.actualHostExecutors[host];
    const plugin = profile.actualHostPlugins[host];
    exactKeys(executor, ["executable", "executableDigest", "env"]);
    exactKeys(plugin, ["installedRoot", "cliPath", "executable", "args", "cwd", "env"]);
    for (const path of [executor.executable, plugin.installedRoot, plugin.cliPath, plugin.executable, plugin.cwd]) absolute(path);
    assert(DIGEST.test(executor.executableDigest) && Array.isArray(plugin.args) && plugin.args.every((arg) => typeof arg === "string" && !arg.includes("\0")), "invalid root Host executable profile");
    for (const env of [executor.env, plugin.env]) assert(env !== null && typeof env === "object" && !Array.isArray(env) && Object.values(env).every((value) => typeof value === "string" && !value.includes("\0")), "invalid root Host environment");
    assert(plugin.cliPath === join(plugin.installedRoot, "bin", "understand-code.mjs"), "plugin CLI is outside its actual installation");
  }
  assert(profile.actualHostPlugins.codex.installedRoot !== profile.actualHostPlugins.claude.installedRoot, "Host installations are not independent");
  return profile;
}

// Configuration and login checks only: never invokes a model or a Task tool.
export async function step16RootPreflightV1(fixture, environment = process.env) {
  const blocked = (blocker) => ({ evidence: { schemaVersion: 1, profile: "step16_root_supervised_fixed_workflow_v1", status: "blocked", countsTowardG2OrG3: false, blocker } });
  const profilePath = environment.UNDERSTAND_CODE_STEP16_ROOT_HOST_PROFILE_PATH;
  if (profilePath === undefined) return blocked("root_host_profile_unavailable");
  let profile;
  try { profile = await readStep16RootHostProfileV1(profilePath); }
  catch { return blocked("root_host_profile_invalid"); }
  const preflightOnly = environment.UNDERSTAND_CODE_STEP16_PREFLIGHT_ONLY === "1";
  if (!preflightOnly && environment.UNDERSTAND_CODE_STEP16_MODEL_RUN_AUTHORIZED !== "1") return blocked("model_run_not_authorized");
  for (const host of ["codex", "claude"]) {
    const executor = profile.actualHostExecutors[host];
    try {
      for (let path = executor.executable; ; path = dirname(path)) {
        const metadata = await lstat(path);
        assert(!metadata.isSymbolicLink() && metadata.uid === 0 && (metadata.mode & 0o022) === 0 &&
          (path === executor.executable ? metadata.isFile() && metadata.nlink === 1 && (metadata.mode & 0o111) !== 0 && (metadata.mode & 0o6000) === 0 : metadata.isDirectory()), "unprotected CLI path");
        if (dirname(path) === path) break;
      }
      assert(`sha256:${createHash("sha256").update(await readFile(executor.executable)).digest("hex")}` === executor.executableDigest, "wrong CLI digest");
      if (preflightOnly) continue;
      const status = await promisify(execFile)(executor.executable, host === "codex" ? ["login", "status"] : ["auth", "status", "--json"], {
        uid: fixture.callerUid, gid: fixture.callerGid, env: executor.env, cwd: fixture.step16RepositoryRoot,
        encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024,
      });
      assert(host !== "claude" || JSON.parse(status.stdout).loggedIn === true, "Claude is not logged in");
    } catch { return blocked(`${host}_cli_or_login_unavailable`); }
  }
  return { profile };
}

/** Creates task-owned launchers, never modifies the installed release. Both
 * this launcher and the installed Linux wrapper must execve, so the final
 * real CLI Node is the sole process in the native SafeGit supervisor leaf. */
export async function createStep16RootMcpLaunchersV1(directory, plugins, repositoryRoot, identity) {
  assert(process.platform === "linux" && process.geteuid?.() === 0 && process.getegid?.() === 0 && typeof process.execve === "function", "root Linux execve launcher is required");
  absolute(directory);
  absolute(repositoryRoot);
  assert(identity.uid === 42003 && identity.gid === 42004, "unexpected fixed caller identity");
  await mkdir(directory, { mode: 0o700 });
  await chown(directory, 0, identity.gid);
  await chmod(directory, 0o710);
  const servers = {};
  for (const host of ["codex", "claude"]) {
    const plugin = plugins[host];
    const env = { ...plugin.env, ...(host === "claude" ? { CLAUDE_PROJECT_DIR: repositoryRoot } : {}) };
    const source = `import { lstatSync, readFileSync, readdirSync, realpathSync, statfsSync, writeFileSync } from "node:fs";
const demand = (ok) => { if (!ok) throw new Error("step16_mcp_launcher_boundary_failed"); };
demand(process.platform === "linux" && process.getuid() === 42003 && process.getgid() === 42004 && typeof process.execve === "function");
const domain = "/sys/fs/cgroup/understand-code-step16-caller-v1";
const parent = domain + "/safe-git";
const leaf = parent + "/understand-code-safe-git-supervisor-v1";
for (const path of [domain, domain + "/host", parent, leaf]) {
  const st = lstatSync(path);
  demand(st.isDirectory() && !st.isSymbolicLink() && st.uid === 42003 && st.gid === 42004 && (st.mode & 0o7777) === 0o700 && realpathSync(path) === path && statfsSync(path).type === 0x63677270);
}
demand(readFileSync("/proc/self/cgroup", "utf8").trim() === "0::/understand-code-step16-caller-v1/host");
demand(readFileSync(parent + "/cgroup.procs", "utf8").trim() === "" && readFileSync(leaf + "/cgroup.procs", "utf8").trim() === "");
demand(readdirSync(parent, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).join() === "understand-code-safe-git-supervisor-v1");
for (const path of [domain, parent]) demand(readFileSync(path + "/cgroup.subtree_control", "utf8").trim().split(/\\s+/).sort().join() === "memory,pids");
writeFileSync(leaf + "/cgroup.procs", String(process.pid));
demand(readFileSync(leaf + "/cgroup.procs", "utf8").trim() === String(process.pid));
process.chdir(${JSON.stringify(repositoryRoot)});
process.execve(${JSON.stringify(plugin.executable)}, ${JSON.stringify([plugin.executable, ...plugin.args])}, ${JSON.stringify(env)});
throw new Error("step16_mcp_execve_returned");
`;
    const path = join(directory, `${host}.mjs`);
    await writeFile(path, source, { flag: "wx", mode: 0o400 });
    await chown(path, 0, identity.gid);
    await chmod(path, 0o440);
    servers[host] = Object.freeze({ command: process.execPath, args: Object.freeze([path]), env: Object.freeze(env) });
  }
  return Object.freeze(servers);
}

export function step16FixedWorkflowStagesV1() {
  const mcp = (id, host, tool, extra = {}) => ({ id, host, kind: "mcp_tool_call", tool, ...extra });
  return Object.freeze([
    mcp("initial_refresh", "codex", "refresh_index", { strong: true }),
    // build_task_brief captures the task baseline in the Provider.
    mcp("build", "codex", "build_task_brief", { strong: true }),
    ...["confirm_goal", "confirm_acceptance", "confirm_plan", "planned", "in_progress"].map((id) => mcp(id, "codex", "update_task")),
    { id: "source", host: "codex", kind: "host_action", action: "source_mutation", mechanism: "file_change" },
    mcp("handoff", "claude", "get_task_brief"),
    mcp("actual_refresh", "claude", "refresh_index", { strong: true }),
    mcp("check_required", "claude", "update_task"),
    mcp("check", "claude", "check_change", { strong: true }),
    ...Array.from({ length: STEP16_EXPECTED_BLOCKING_FINDINGS_V1 }, (_, findingIndex) => mcp(`accept_${findingIndex}`, "claude", "update_task", { findingIndex })),
    mcp("verification_required", "claude", "update_task"),
    { id: "verification", host: "claude", kind: "host_action", action: "verification", mechanism: "command_execution" },
    mcp("record", "claude", "record_verification", { strong: true }),
    mcp("verified", "claude", "update_task", { strong: true }),
    mcp("codex_final", "codex", "get_task_brief"),
    mcp("claude_final", "claude", "get_task_brief"),
    mcp("codex_evidence", "codex", "get_evidence"),
    mcp("claude_evidence", "claude", "get_evidence"),
    mcp("codex_pulse", "codex", "get_repo_pulse"),
    mcp("claude_pulse", "claude", "get_repo_pulse"),
  ].map((stage, index) => Object.freeze({ ...stage, eventOrdinal: index + 1 })));
}

function fixedArguments(id) {
  if (id === "initial_refresh") return { mode: "full", idempotencyKey: "step16-codex-initial-refresh", actor: CODEX_ACTOR };
  if (id === "build") return { task: STEP16_TASK_INTENT_V1, expectedRevision: 0, idempotencyKey: "step16-codex-build-task", actor: CODEX_ACTOR, scope: ["src/task.ts"], tokenBudget: 8000, maxCandidates: 20, maxImpactDepth: 4 };
  return undefined;
}

export function createStep16FixedClosingPlanV1(runNonce) {
  assert(typeof runNonce === "string" && /^[0-9a-f]{64}$/u.test(runNonce), "invalid fixed workflow nonce");
  const calls = step16FixedWorkflowStagesV1().filter((stage) => stage.strong).map((stage, index) => Object.freeze({
    callOrdinal: index + 1, eventOrdinal: stage.eventOrdinal, host: stage.host, tool: stage.tool,
    argumentsDigest: fixedArguments(stage.id) === undefined ? null : step16ArgumentsDigestV1(fixedArguments(stage.id)),
  }));
  return Object.freeze({ runNonce, calls: Object.freeze(calls), closingPlanDigest: step16ArgumentsDigestV1(["understand-code-step16-host-call-closing-plan-v1", { runNonce, calls }]) });
}

async function storeState(repositoryRoot, requireTask = true) {
  const { ArtifactStore } = await import("../../artifact-store/dist/index.js");
  const { ArtifactManifestV1Schema } = await import("../../contracts/dist/index.js");
  const selected = ArtifactManifestV1Schema.parse(JSON.parse(await readFile(join(repositoryRoot, ".understand-code", "artifact-manifest.json"), "utf8")));
  const store = await ArtifactStore.open(repositoryRoot, { repositoryId: selected.repositoryId, worktreeId: selected.worktreeId, producerVersion: selected.producerVersion });
  const manifest = await store.readManifest();
  assert(step16ArgumentsDigestV1(selected) === step16ArgumentsDigestV1(manifest), "Store Manifest moved during root read");
  if (!requireTask) return { store, manifest };
  const entries = await readdir(store.layout.tasks, { withFileTypes: true });
  assert(entries.length === 1 && entries[0].isDirectory(), "fixed fixture must have exactly one Task");
  const task = await store.readTaskBundle(entries[0].name);
  assert(task.recoveryState === "current" && task.bundle.brief.originalIntent === STEP16_TASK_INTENT_V1, "Task is not the fixed current fixture");
  return { store, manifest, bundle: task.bundle };
}

function checkBusinessDigest(args) {
  return step16ArgumentsDigestV1(["operation-safe-request-v1", {
    version: "operation-safe-request-v1", operation: "check_change", actor: args.actor,
    expectedRevision: args.expectedRevision, snapshotAssertions: { actualSnapshotId: args.actualSnapshotId },
    safeInput: { taskId: args.taskId, includeWorktree: true },
  }]);
}

export async function readStep16FixedProjectionV1(provider, repositoryRoot, operation = "check_change") {
  const { readCommittedStrongTaskProjectionInternalV1 } = await import("../../artifact-store/dist/committed-strong-task-projection-reader-internal.js");
  const { manifest, bundle } = await storeState(repositoryRoot);
  const checkArgs = { taskId: bundle.manifest.taskId, actualSnapshotId: manifest.latestSnapshotId, actor: CLAUDE_ACTOR, expectedRevision: 7 };
  const committedRevision = operation === "check_change" ? 8 : (operation === "update_task" ? 11 : 10) + STEP16_EXPECTED_BLOCKING_FINDINGS_V1;
  const projection = await readCommittedStrongTaskProjectionInternalV1(provider, {
    taskId: bundle.manifest.taskId, operation, committedRevision,
    ...(operation === "check_change" ? { requestDigest: checkBusinessDigest(checkArgs) } : {}),
  });
  const event = projection.bundle.events.at(-1);
  assert(event.actor === CLAUDE_ACTOR && event.idempotencyKey === (operation === "check_change" ? "step16-claude-check-change" : operation === "update_task" ? "step16-claude-verified" : "step16-claude-record-verification"), "Provider projection is from another fixed request");
  assert(projection.bundle.manifest.latestSnapshotId === manifest.latestSnapshotId, "Provider projection bound another actual Snapshot");
  if (operation === "check_change") assert(projection.outcome.changeCheck.findings.filter((finding) => finding.blocking).length === STEP16_EXPECTED_BLOCKING_FINDINGS_V1, "fixed fixture blocking Finding count differs from the closing plan");
  else if (operation === "record_verification") {
    const verification = projection.outcome.verification;
    const entry = projection.bundle.brief.verificationPlan[0];
    assert(verification.snapshotId === manifest.latestSnapshotId && verification.verificationPlanEntryId === entry.id && verification.method === entry.method && verification.status === "passed" && step16ArgumentsDigestV1([...verification.claimIds].sort()) === step16ArgumentsDigestV1([...entry.acceptanceClaimIds].sort()), "Provider verification differs from the root recipe");
  } else {
    assert(projection.bundle.manifest.status === "verified" && event.action.type === "transition_status" && event.action.to === "verified", "Provider Task transition differs from the root recipe");
  }
  return projection;
}

export async function step16FixedStageArgumentsV1(stage, { repositoryRoot, provider }) {
  const fixed = fixedArguments(stage.id);
  if (fixed !== undefined) return fixed;
  if (stage.id === "source") return { changes: [{ kind: "update", path: "src/task.ts" }] };
  if (stage.id === "verification") return { command: STEP16_VERIFICATION_COMMAND_V1 };
  if (stage.id.endsWith("_pulse")) return {};
  const { manifest, bundle } = await storeState(repositoryRoot);
  const taskId = bundle.manifest.taskId;
  const brief = bundle.brief;
  const count = STEP16_EXPECTED_BLOCKING_FINDINGS_V1;
  const update = (expectedRevision, action, key, actor = CLAUDE_ACTOR) => {
    assert(bundle.manifest.revision === expectedRevision, `unexpected Task revision before ${stage.id}`);
    return { taskId, action, expectedRevision, idempotencyKey: key, actor };
  };
  const contextGenerationId = brief.contextGenerationId;
  switch (stage.id) {
    case "confirm_goal": return update(1, { type: "confirm_goal", claimId: brief.goalClaimId, contextGenerationId }, "step16-codex-confirm-goal", CODEX_ACTOR);
    case "confirm_acceptance": return update(2, { type: "confirm_acceptance_criteria", claimIds: brief.acceptanceClaimIds, contextGenerationId }, "step16-codex-confirm-acceptance", CODEX_ACTOR);
    case "confirm_plan": return update(3, { type: "confirm_plan", plannedChangeIds: brief.plannedChanges.map((item) => item.id), contextGenerationId }, "step16-codex-confirm-plan", CODEX_ACTOR);
    case "planned": return update(4, { type: "transition_status", to: "planned" }, "step16-codex-planned", CODEX_ACTOR);
    case "in_progress": return update(5, { type: "transition_status", to: "in_progress" }, "step16-codex-in-progress", CODEX_ACTOR);
    case "actual_refresh": return { mode: "incremental", expectedSourceSnapshotId: bundle.manifest.latestSnapshotId, idempotencyKey: "step16-claude-actual-refresh", actor: CLAUDE_ACTOR };
    case "check_required": return update(6, { type: "transition_status", to: "check_required" }, "step16-claude-check-required");
    case "check":
      assert(bundle.manifest.revision === 7 && manifest.latestSnapshotId !== bundle.manifest.baselineSnapshotId, "unexpected pre-check fixture state");
      return { profile: "check_changes_strong_v1", taskId, actualSnapshotId: manifest.latestSnapshotId, includeWorktree: true, expectedRevision: 7, idempotencyKey: "step16-claude-check-change", actor: CLAUDE_ACTOR };
    case "verification_required": return update(8 + count, { type: "transition_status", to: "verification_required" }, "step16-claude-verification-required");
    case "record": {
      const projection = await readStep16FixedProjectionV1(provider, repositoryRoot);
      const entry = projection.bundle.brief.verificationPlan[0];
      assert(bundle.manifest.revision === 9 + count && entry !== undefined, "unexpected pre-verification fixture state");
      return { profile: "record_verification_strong_v1", taskId, snapshotId: manifest.latestSnapshotId, verificationPlanEntryId: entry.id, method: entry.method, status: "passed", claimIds: [...entry.acceptanceClaimIds].sort(), ...(entry.method === "manual" ? {} : { command: { executable: "/opt/understand-code/bin/git", arguments: ["diff", "--check"], workingDirectory: "repository_root", environmentKeys: [] }, exitCode: 0 }), summary: "Externally executed repository diff validation passed.", expectedRevision: 9 + count, idempotencyKey: "step16-claude-record-verification", actor: CLAUDE_ACTOR };
    }
    case "verified":
      await readStep16FixedProjectionV1(provider, repositoryRoot, "record_verification");
      return update(10 + count, { type: "transition_status", to: "verified" }, "step16-claude-verified");
    default:
      if (stage.findingIndex !== undefined) {
        const projection = await readStep16FixedProjectionV1(provider, repositoryRoot);
        const finding = projection.outcome.changeCheck.findings.filter((entry) => entry.blocking)[stage.findingIndex];
        return update(8 + stage.findingIndex, { type: "accept_finding", findingId: finding.id, reason: "Step16 synthetic Alpha explicitly accepts this observed finding." }, `step16-claude-accept-${finding.id}`);
      }
      if (stage.id.endsWith("_evidence")) return { taskId, evidenceIds: bundle.evidence.map((entry) => entry.id).sort(), pageSize: 200 };
      if (stage.tool === "get_task_brief") return { taskId, section: "summary", pageSize: 50 };
      throw new Error("unknown fixed workflow stage");
  }
}

export async function verifyStep16FixedStageCommitV1(stage, args, context) {
  if (stage.id === "initial_refresh" || stage.id === "actual_refresh") {
    const { manifest } = await storeState(context.repositoryRoot, false);
    assert(typeof manifest.latestSnapshotId === "string" && (stage.id !== "actual_refresh" || manifest.latestSnapshotId !== args.expectedSourceSnapshotId), "refresh did not publish its exact new Snapshot");
  } else if (stage.tool === "build_task_brief" || stage.tool === "update_task") {
    const { bundle } = await storeState(context.repositoryRoot);
    const event = bundle.events.at(-1);
    assert(bundle.manifest.revision === args.expectedRevision + 1 && event.previousRevision === args.expectedRevision && event.revision === args.expectedRevision + 1 && event.actor === args.actor && event.idempotencyKey === args.idempotencyKey, "Task commit did not match the root-owned request");
    if (stage.tool === "update_task") {
      const { UpdateTaskInputV1Schema } = await import("../../contracts/dist/index.js");
      const normalized = UpdateTaskInputV1Schema.parse(args);
      assert(event.requestDigest === step16ArgumentsDigestV1(normalized) && step16ArgumentsDigestV1(event.action) === step16ArgumentsDigestV1(normalized.action), "Task action or request digest differs from the root recipe");
    }
    if (args.action?.type === "transition_status") assert(bundle.manifest.status === args.action.to, "Task transition was not committed");
    if (stage.id === "verified") await readStep16FixedProjectionV1(context.provider, context.repositoryRoot, "update_task");
  } else if (stage.id === "check" || stage.id === "record") await readStep16FixedProjectionV1(context.provider, context.repositoryRoot, stage.id === "check" ? "check_change" : "record_verification");
}

export async function readStep16FixedFinalTaskV1(repositoryRoot) {
  const { bundle, manifest } = await storeState(repositoryRoot);
  assert(bundle.manifest.status === "verified" && bundle.manifest.revision === 11 + STEP16_EXPECTED_BLOCKING_FINDINGS_V1, "fixed workflow did not finish the exact Task revision");
  return { taskId: bundle.manifest.taskId, taskRevision: bundle.manifest.revision, actualSnapshotId: manifest.latestSnapshotId };
}
