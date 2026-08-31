import { execFile, spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
// The harness requires root, a dedicated ext4 mount, and the real Linux
// principal boundary.  It is opt-in so ordinary macOS/CI runs remain
// read-only; Fedora gate runs set RUN_STEP15_PROVIDER_E2E=1 explicitly.
const runnable =
  process.platform === "linux" &&
  process.geteuid?.() === 0 &&
  process.env.RUN_STEP15_PROVIDER_E2E === "1";
const e2eTimeout = process.env.RUN_STEP16_DUAL_HOST_E2E === "1"
  ? 90 * 60 * 1000
  : 15 * 60 * 1000;

describe.skipIf(!runnable)("production strong object three-principal Linux", () => {
  it("runs the public gateway/client across authority, runtime, and caller principals", async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      new URL(
        "./provider-production-strong-object-three-principal-linux.mjs",
        import.meta.url,
      ).pathname,
    ], {
      env: { ...process.env, RUN_STEP15_PROVIDER_E2E: "1" },
      maxBuffer: 32 * 1024 * 1024,
      timeout: e2eTimeout,
    });
    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      profile: "provider_production_strong_object_three_principal_linux_v1",
      status: "verified",
      ext4: true,
      foreignCallerRejected: true,
      authorityUid: 0,
      nativeExactObject: {
        status: "verified",
        exactObject: "verified",
        noReplace: "verified",
        renameReparent: "rejected_zero_write",
        pathnameAba: "rejected_zero_write",
        sourceSwap: "rejected_zero_write",
      },
      caller: {
        role: "caller",
        keyDenied: true,
        keyDenials: 4,
        write: "committed",
        check: "committed",
        checkReplay: "committed",
        verification: "committed",
        revision: 3,
        revisionOnly: true,
        reservedForgeryRejected: true,
      },
      restartReplay: {
        role: "caller",
        keyDenied: true,
        keyDenials: 4,
        write: "committed",
        check: "committed",
        checkReplay: "committed",
        verification: "committed",
        revision: 3,
      },
      restartSockets: {
        retainedAfterSigkill: "verified",
        broker: "reclaimed",
        runtime: "reclaimed",
        gateway: "reclaimed",
        startOrder: "authority_runtime_gateway",
      },
      lifecycleLease: {
        liveUninstall: "refused_zero_write",
        doubleStart: "rejected",
      },
      casNonce: {
        role: "cas-probe",
        writeNonceConflict: true,
        compareNonceConflict: true,
        stale: "stale",
        staleReplay: "stale",
        revision: 4,
      },
      trustRotationReplay: {
        role: "trust-rotation-replay",
        acceptanceOrdinal: 2,
        resolution: "committed",
        originalRevision: 2,
        currentRevision: 4,
        zeroWrite: true,
      },
      durableCurrent: {
        revision: result.dualHost?.status === "verified_not_gold" ? result.dualHost.providerRevision : 4,
        lifecycleArtifactCount: 17,
        businessHeadPresent: true,
      },
      lifecycle: {
        install: "installed",
        upgrade: "rotated",
        rollback: "rolled_back",
        uninstall: "uninstalled",
        retainedIdentity: "verified",
      },
    });
    expect(result.runtimeUid).toBe(result.nativeExactObject.principalUid);
    expect(result.callerUid).toBe(result.caller.callerUid);
    expect(new Set([
      result.authorityUid,
      result.runtimeUid,
      result.callerUid,
    ]).size).toBe(3);
    expect(result.restartReplay.read).toBe(result.caller.read);
    if (process.env.RUN_STEP16_DUAL_HOST_E2E === "1") {
      expect(result.dualHost).toMatchObject({
        profile: "step16_root_supervised_fixed_workflow_v1",
        countsTowardG2OrG3: false,
      });
      expect(result.closingEvidenceSafety).toEqual({
        symlinkPreset: "rejected_zero_write",
        unknownPath: "rejected_zero_write",
        create: "exclusive_nofollow_root_owned_fsync",
      });
      if (result.dualHost.status === "preflight_verified") {
        expect(result.dualHost).toMatchObject({ modelInvoked: false, businessToolsInvoked: false });
        expect(result.dualHost.preflights).toHaveLength(2);
        expect(result.dualHost.preflights.every((item: { singlePid: boolean; advertisedTools: number }) => item.singlePid && item.advertisedTools === 11)).toBe(true);
      } else if (result.dualHost.status === "verified_not_gold") {
        expect(result.dualHost).toMatchObject({
          executionSurface: "real_host_cli_jsonl", completedCalls: 5,
          expectedBlockingFindingCount: 1, taskRevision: 12,
        });
        expect(result.dualHost.executions).toHaveLength(23);
        expect(result.dualHost.closingPlan.calls).toHaveLength(5);
        expect(result.dualHost.strongCallProviderReceipts).toHaveLength(5);
        expect(result.dualHost.providerBindings.length).toBeGreaterThan(0);
        expect(result.durableCurrent.revision).toBe(
          result.dualHost.providerRevision,
        );
      } else {
        expect(result.dualHost.status).toBe("blocked");
        expect(result.dualHost.blocker).toMatch(/^(root_host_profile_(unavailable|invalid)|model_run_not_authorized|(codex|claude)_cli_or_login_unavailable)$/u);
      }
    }
  }, e2eTimeout);
});

async function fixedRecipeV1() {
  return import(new URL("./step16-root-fixed-workflow-linux.mjs", import.meta.url).href);
}

describe("Step16 authority lifecycle", () => {
  it("distinguishes preflight readiness from a listening witness and pins the authority PID", async () => {
    const { requireStep16AuthorityReadyV1 } = await fixedRecipeV1();
    const preflight = { authorityPid: 123, mode: "preflight_only", witness: "not_started" };
    const normal = { authorityPid: 123, mode: "witness", witness: "listening" };
    expect(requireStep16AuthorityReadyV1(preflight, 123, true)).toBe(preflight);
    expect(requireStep16AuthorityReadyV1(normal, 123, false)).toBe(normal);
    expect(() => requireStep16AuthorityReadyV1(preflight, 123, false)).toThrow();
    expect(() => requireStep16AuthorityReadyV1(normal, 123, true)).toThrow();
    expect(() => requireStep16AuthorityReadyV1(preflight, 124, true)).toThrow();
    expect(() => requireStep16AuthorityReadyV1({ ...preflight, witness: "listening" }, 123, true)).toThrow();
  });

  it("closes the production service cleanly when preflight never opened a witness", async () => {
    const { closeStep16AuthorityServicesV1 } = await fixedRecipeV1();
    let closed = false;
    await closeStep16AuthorityServicesV1(undefined, { close: async () => { closed = true; } });
    expect(closed).toBe(true);
  });

  it("still closes the service after witness rejection and retains both cleanup failures", async () => {
    const { closeStep16AuthorityServicesV1 } = await fixedRecipeV1();
    const order: string[] = [];
    const witnessError = new Error("incomplete_plan");
    const serviceError = new Error("service_close_failed");
    await expect(closeStep16AuthorityServicesV1(
      { close: async () => { order.push("witness"); throw witnessError; } },
      { close: async () => { order.push("service"); throw serviceError; } },
    )).rejects.toMatchObject({ errors: [witnessError, serviceError] });
    expect(order).toEqual(["witness", "service"]);
  });

  for (const code of [0, 7]) {
    it(`accepts authority exit only when its actual code is zero (code ${code})`, async () => {
      const { waitForSuccessfulAuthorityExitV1 } = await fixedRecipeV1();
      const child = spawn(process.execPath, ["-e", `process.exit(${code})`], { stdio: "ignore" });
      const completed = waitForSuccessfulAuthorityExitV1(child);
      if (code === 0) await expect(completed).resolves.toBeUndefined();
      else await expect(completed).rejects.toThrow("code=7");
    });
  }

  it("rejects an authority that exited before the shutdown listener was installed", async () => {
    const { waitForSuccessfulAuthorityExitV1 } = await fixedRecipeV1();
    const child = spawn(process.execPath, ["-e", "process.exit(9)"], { stdio: "ignore" });
    await new Promise((resolvePromise, rejectPromise) => {
      child.once("error", rejectPromise);
      child.once("exit", resolvePromise);
    });
    await expect(waitForSuccessfulAuthorityExitV1(child)).rejects.toThrow("code=9");
  });

  it("rejects authority termination by signal", async () => {
    const { waitForSuccessfulAuthorityExitV1 } = await fixedRecipeV1();
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    const completed = waitForSuccessfulAuthorityExitV1(child);
    const rejected = expect(completed).rejects.toThrow("signal=SIGTERM");
    child.kill("SIGTERM");
    await rejected;
  });

  it.skipIf(process.platform !== "linux" || process.geteuid?.() !== 0)("pins the PID through the actual unshare exec launch", async () => {
    const { waitForSuccessfulAuthorityExitV1 } = await fixedRecipeV1();
    const child = spawn("/usr/bin/unshare", ["--mount", "--propagation", "private", process.execPath, "-e", "process.stdout.write(String(process.pid))"], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    await waitForSuccessfulAuthorityExitV1(child);
    expect(Number(output)).toBe(child.pid);
  });
});

describe("Step16 fixed root workflow recipe", () => {
  it("pins all five strong calls, including the Task baseline, in global order", async () => {
    const recipe = await fixedRecipeV1();
    const plan = recipe.createStep16FixedClosingPlanV1("a1".repeat(32));
    const calls = plan.calls as Array<{ tool: string; eventOrdinal: number; callOrdinal: number; argumentsDigest: string | null }>;
    expect(calls.map((call) => call.tool)).toEqual(["refresh_index", "build_task_brief", "refresh_index", "check_change", "record_verification"]);
    expect(calls.map((call) => call.eventOrdinal)).toEqual([1, 2, 10, 12, 16]);
    expect(calls.map((call) => call.callOrdinal)).toEqual([1, 2, 3, 4, 5]);
    expect(calls.map((call) => call.argumentsDigest === null)).toEqual([false, false, true, true, true]);
    expect(Object.isFrozen(plan) && Object.isFrozen(calls) && calls.every(Object.isFrozen)).toBe(true);
    expect(recipe.step16FixedWorkflowStagesV1()).toHaveLength(23);
  });

  it("derives the first two exact arguments without querying artifacts or a provider", async () => {
    const recipe = await fixedRecipeV1();
    const plan = recipe.createStep16FixedClosingPlanV1("b2".repeat(32));
    for (const [index, stage] of recipe.step16FixedWorkflowStagesV1().slice(0, 2).entries()) {
      const args = await recipe.step16FixedStageArgumentsV1(stage, { repositoryRoot: "/missing-root", provider: undefined });
      expect(recipe.step16ArgumentsDigestV1(args)).toBe(plan.calls[index].argumentsDigest);
      expect(args.taskId).toBeUndefined();
    }
  });

  it("binds the complete immutable closing plan to one run nonce", async () => {
    const recipe = await fixedRecipeV1();
    const first = recipe.createStep16FixedClosingPlanV1("c3".repeat(32));
    expect(first.closingPlanDigest).toBe(recipe.step16ArgumentsDigestV1(["understand-code-step16-host-call-closing-plan-v1", { runNonce: first.runNonce, calls: first.calls }]));
    expect(first.closingPlanDigest).not.toBe(recipe.createStep16FixedClosingPlanV1("d4".repeat(32)).closingPlanDigest);
    for (const bad of ["", "a1".repeat(16), "G".repeat(64)]) expect(() => recipe.createStep16FixedClosingPlanV1(bad)).toThrow();
  });

  it("reports a missing profile without starting a Host or inspecting future artifacts", async () => {
    const recipe = await fixedRecipeV1();
    expect(await recipe.step16RootPreflightV1({}, {})).toMatchObject({ evidence: { status: "blocked", blocker: "root_host_profile_unavailable", countsTowardG2OrG3: false } });
  });

  it("reads future Task/evidence/Snapshot arguments from real committed artifacts and rejects changed bytes", async () => {
    const recipe = await fixedRecipeV1();
    const { ArtifactStore } = await import("../../artifact-store/dist/index.js");
    const { TaskEngine } = await import("../../task-engine/dist/index.js");
    const root = await mkdtemp(join(tmpdir(), "step16-recipe-artifacts-"));
    const load = async (name: string) => JSON.parse(await readFile(new URL(`../../contracts/fixtures/v1/reference/${name}`, import.meta.url), "utf8"));
    try {
      const store = await ArtifactStore.open(root, { repositoryId: "repository:fixture", worktreeId: "worktree:fixture", producerVersion: "3.0.0-alpha.1" });
      await store.initialize();
      await store.persistArtifact(await load("repository-snapshot.json"));
      await store.persistArtifact(await load("repo-pulse.json"));
      // Real local Task creation includes its complete operation journal. The
      // repository Snapshot is legacy: this is not strong Provider/model proof.
      const engine = new TaskEngine(store, {
        contextProvider: {
          binding: { schemaVersion: 1, kind: "canonical_worktree_root", canonicalRoot: store.layout.worktreeRoot },
          async loadTaskContext() { return {
            graph: { version: "1", project: { name: "root-recipe-fixture", languages: ["TypeScript"], frameworks: [], description: "Root recipe artifact test", analyzedAt: "2026-07-29T00:00:00Z", gitCommitHash: "a".repeat(40) }, nodes: [], edges: [], layers: [], tour: [] },
            existingFilePaths: [],
          }; },
        },
        clock: () => new Date("2026-07-29T08:00:00.000Z"),
      });
      const args = await recipe.step16FixedStageArgumentsV1({ id: "build" }, {});
      const auth = { actor: args.actor, repositoryId: store.repositoryId, worktreeId: store.worktreeId, capabilities: ["task:create", "task:update", "task:confirm"] as const };
      const built = await engine.buildTaskBrief(args, auth);
      const bundle = (await store.readTaskBundle(built.task.taskId)).bundle;
      if (!("brief" in bundle) || !("evidence" in bundle)) throw new Error("test Task context was not committed");
      const context = { repositoryRoot: root, provider: undefined };
      expect(await recipe.step16FixedStageArgumentsV1({ id: "handoff", tool: "get_task_brief" }, context)).toEqual({ taskId: bundle.manifest.taskId, section: "summary", pageSize: 50 });
      expect(await recipe.step16FixedStageArgumentsV1({ id: "claude_evidence" }, context)).toEqual({ taskId: bundle.manifest.taskId, evidenceIds: bundle.evidence.map((entry) => entry.id).sort(), pageSize: 200 });
      expect(await recipe.step16FixedStageArgumentsV1({ id: "actual_refresh" }, context)).toMatchObject({ expectedSourceSnapshotId: bundle.manifest.latestSnapshotId });
      const update = { taskId: bundle.manifest.taskId, action: { type: "confirm_goal" as const, claimId: bundle.brief.goalClaimId }, expectedRevision: bundle.manifest.revision, idempotencyKey: "root-recipe-confirm-goal", actor: args.actor };
      await engine.updateTask(update, auth);
      await recipe.verifyStep16FixedStageCommitV1({ tool: "update_task" }, update, context);
      await expect(recipe.verifyStep16FixedStageCommitV1({ tool: "update_task" }, { ...update, action: { type: "confirm_acceptance_criteria", claimIds: bundle.brief.acceptanceClaimIds } }, context)).rejects.toThrow("Task action or request digest");
      await writeFile(store.layout.task(bundle.manifest.taskId).taskBrief, "{}\n");
      await expect(recipe.step16FixedStageArgumentsV1({ id: "handoff", tool: "get_task_brief" }, context)).rejects.toThrow();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

describe.skipIf(process.platform !== "linux" || process.geteuid?.() !== 0)("Step16 root control file", () => {
  it("keeps a valid but unauthorised profile blocked before launching either native CLI", async () => {
    const recipe = await fixedRecipeV1();
    const root = await mkdtemp("/opt/step16-root-auth-gate-test-");
    const path = join(root, "profile.json");
    try {
      const executors = Object.fromEntries(["codex", "claude"].map((host) => [host, { executable: `/missing-${host}`, executableDigest: `sha256:${"a".repeat(64)}`, env: {} }]));
      const plugins = Object.fromEntries(["codex", "claude"].map((host) => [host, { installedRoot: `/${host}`, cliPath: `/${host}/bin/understand-code.mjs`, executable: "/missing-node", args: [], cwd: `/${host}`, env: {} }]));
      await writeFile(path, JSON.stringify({ schemaVersion: 1, profile: "step16_root_host_profile_v1", actualHostExecutors: executors, actualHostPlugins: plugins }), { mode: 0o600 });
      expect(await recipe.step16RootPreflightV1({}, { UNDERSTAND_CODE_STEP16_ROOT_HOST_PROFILE_PATH: path })).toMatchObject({ evidence: { status: "blocked", blocker: "model_run_not_authorized" } });
      expect(await recipe.step16RootPreflightV1({}, { UNDERSTAND_CODE_STEP16_ROOT_HOST_PROFILE_PATH: path, UNDERSTAND_CODE_STEP16_MODEL_RUN_AUTHORIZED: "1" })).toMatchObject({ evidence: { status: "blocked", blocker: "codex_cli_or_login_unavailable" } });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  for (const variant of ["exact", "writable", "symlink"] as const) {
    it(`handles ${variant} root control state without accepting an unsafe replacement`, async () => {
      const recipe = await fixedRecipeV1();
      const root = await mkdtemp("/opt/step16-root-control-test-");
      const path = join(root, "control.json");
      try {
        await writeFile(path, JSON.stringify({ rootControl: true }), { mode: 0o600 });
        if (variant === "writable") await chmod(path, 0o666);
        if (variant === "symlink") {
          await symlink(path, join(root, "link.json"));
          await expect(recipe.readStep16RootControlJsonV1(join(root, "link.json"))).rejects.toThrow();
        } else if (variant === "writable") await expect(recipe.readStep16RootControlJsonV1(path)).rejects.toThrow();
        else expect(await recipe.readStep16RootControlJsonV1(path)).toEqual({ rootControl: true });
      } finally { await rm(root, { recursive: true, force: true }); }
    });
  }
});
