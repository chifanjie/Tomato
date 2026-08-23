import { spawn } from "node:child_process";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function gateEnvironment(overrides) {
  const environment = { ...process.env, ...overrides };
  delete environment.UNDERSTAND_CODE_PREVIEW_TARBALL;
  return environment;
}

async function runGate(testFile, environment) {
  const child = spawn(process.execPath, ["--test", testFile], {
    cwd: packageRoot,
    env: environment,
    stdio: "inherit",
  });
  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  if (result.code !== 0) {
    throw new Error(
      `${testFile} failed (code=${result.code}, signal=${result.signal})`,
    );
  }
}

const workspace = await realpath(
  await mkdtemp(path.join(tmpdir(), "uc-surface-release-gate-")),
);
const candidateDirectory = path.join(workspace, "candidate");
try {
  await runGate(
    "test/workbench-browser-packed.test.mjs",
    gateEnvironment({
      UNDERSTAND_CODE_REQUIRE_REAL_BROWSER: "1",
      UNDERSTAND_CODE_SURFACE_CANDIDATE_EXPORT: candidateDirectory,
    }),
  );
  const candidateManifest = JSON.parse(
    await readFile(
      path.join(
        candidateDirectory,
        "understand-code-alpha-candidate.json",
      ),
      "utf8",
    ),
  );
  await runGate(
    "test/plugin-clean-install.test.mjs",
    gateEnvironment({
      UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS: "1",
      UNDERSTAND_CODE_REQUIRE_VERIFIED_CANDIDATE: "1",
      UNDERSTAND_CODE_PREVIEW_CANDIDATE_DIR: candidateDirectory,
      UNDERSTAND_CODE_EXPECTED_CANDIDATE_COMMIT:
        candidateManifest.source.commit,
      UNDERSTAND_CODE_EXPECTED_CANDIDATE_TREE:
        candidateManifest.source.tree,
    }),
  );
} finally {
  await rm(workspace, { recursive: true, force: true });
}
