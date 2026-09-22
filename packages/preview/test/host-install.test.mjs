import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { hostInstallPlan, installPackagedHost } from "../src/host-install.mjs";

test("packaged installer resolves its own marketplace without a global npm path", () => {
  const plan = hostInstallPlan("codex", "/tmp/package with spaces/dist");
  assert.deepEqual(plan[0], ["codex", ["plugin", "marketplace", "add", "/tmp/package with spaces/dist/plugin-roots/codex", "--json"]]);
  assert.deepEqual(plan[1], ["codex", ["plugin", "add", "understand-code@understand-code-alpha", "--json"]]);
  assert.equal(hostInstallPlan("claude", "/tmp/dist").length, 3);
  assert.throws(() => hostInstallPlan("unknown", "/tmp/dist"));
});

function withMarketplace(host, check) {
  const root = mkdtempSync(path.join(tmpdir(), "understand-install-feedback-"));
  const distRoot = path.join(root, "package with ' quote", "dist");
  try {
    mkdirSync(path.join(distRoot, "plugin-roots", host), { recursive: true });
    check(distRoot);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("installer reports success only after Host commands and Doctor complete", () => {
  for (const host of ["codex", "claude"]) withMarketplace(host, (distRoot) => {
    const calls = [];
    const result = installPackagedHost(host, distRoot, (command, args) => calls.push([command, args]));
    assert.deepEqual(calls, [...hostInstallPlan(host, distRoot), [process.execPath, [path.join(distRoot, "understand-code.mjs"), "doctor", "--host", host]]]);
    assert.match(result, /Start a new Host session/u);
  });
});

test("a partial install stops and explains how to resume the failed step without rerunning completed steps", () => {
  withMarketplace("codex", (distRoot) => {
    const calls = [];
    assert.throws(() => installPackagedHost("codex", distRoot, (command, args) => {
      calls.push([command, args]);
      if (calls.length === 2) throw new Error("private host failure");
    }), (error) => {
      assert.match(error.message, /stopped at step 2 of 3/u);
      assert.match(error.message, /codex plugin add understand-code@understand-code-alpha --json/u);
      assert.match(error.message, /doctor --host codex/u);
      assert.equal(error.message.includes("marketplace add"), false);
      assert.equal(error.message.includes("private host failure"), false);
      assert.ok(error.message.includes("'\\''"), "displayed recovery path must quote embedded apostrophes");
      return true;
    });
    assert.equal(calls.length, 2);
  });
});

test("Doctor failure keeps registration distinct from a checked installation", () => {
  withMarketplace("claude", (distRoot) => {
    assert.throws(() => installPackagedHost("claude", distRoot, (_command, args) => {
      if (args.includes("doctor")) throw new Error("unhealthy");
    }), /Plugin registration completed, but Doctor did not pass/u);
  });
});

test("missing Host and missing packaged marketplace have actionable next steps", () => {
  withMarketplace("codex", (distRoot) => {
    assert.throws(() => installPackagedHost("codex", distRoot, () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); }), /codex CLI is not available on PATH/u);
    rmSync(path.join(distRoot, "plugin-roots"), { recursive: true });
    assert.throws(() => installPackagedHost("codex", distRoot, () => assert.fail("must not invoke Host")), /Reinstall the Preview package/u);
  });
});
