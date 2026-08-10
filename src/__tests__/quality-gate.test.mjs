import { afterEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUILD_ARTIFACT_PATHS,
  cleanBuildArtifacts,
} from "../../scripts/clean-build-artifacts.mjs";

const packageJsonPath = fileURLToPath(new URL("../../package.json", import.meta.url));
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const scripts = packageJson.scripts ?? {};
const providerPackageJson = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../packages/durable-object-provider-contracts/package.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
);
const providerScripts = providerPackageJson.scripts ?? {};
const providerDistributionScript = readFileSync(
  fileURLToPath(
    new URL(
      "../../packages/durable-object-provider-contracts/scripts/test-distribution.mjs",
      import.meta.url,
    ),
  ),
  "utf8",
);
const contractsDistributionScript = readFileSync(
  fileURLToPath(
    new URL(
      "../../packages/contracts/scripts/test-distribution.mjs",
      import.meta.url,
    ),
  ),
  "utf8",
);
const vitestConfig = readFileSync(
  fileURLToPath(new URL("../../vitest.config.ts", import.meta.url)),
  "utf8",
);
const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("root quality gate", () => {
  it("runs every maintained test suite instead of printing a hint", () => {
    expect(scripts.test).not.toContain("console.log");
    expect(scripts.test).toContain("pnpm run test:skill");
    expect(scripts.test).toContain(
      "pnpm --filter @understand-code/durable-object-provider-contracts --fail-if-no-match test",
    );
    expect(scripts.test).toContain(
      "pnpm --filter @understand-code/contracts --fail-if-no-match test",
    );
    expect(scripts.test).toContain(
      "pnpm --filter @understand-code/repository-state --fail-if-no-match test",
    );
    expect(scripts.test).toContain(
      "pnpm --filter @understand-code/artifact-store --fail-if-no-match test",
    );
    expect(scripts.test).toContain(
      "pnpm --filter @understand-code/core --fail-if-no-match test",
    );
    expect(scripts.test).toContain(
      "pnpm --filter @understand-code/task-engine --fail-if-no-match test",
    );
    expect(scripts.test).toContain(
      "pnpm --filter @understand-code/dashboard --fail-if-no-match test",
    );
  });

  it("provides one fail-fast command for build, typecheck, and test", () => {
    expect(scripts.quality).toBe(
      "pnpm run build:all && pnpm run typecheck && pnpm run test",
    );
  });

  it("runs the complete Provider verifier once per quality gate", () => {
    const verifierNames = [
      "verify:schemas",
      "verify:fixtures",
      "verify:strict-ed25519",
      "verify:golden",
      "verify:bootstrap-trust-invalid",
      "verify:bootstrap-trust",
      "verify:provider-root-history",
      "verify:provider-registry-manifest-history",
      "verify:provider-registry-manifest-invalid",
      "verify:provider-real-fs-source",
      "verify:provider-target-discovery-point",
      "verify:provider-release-target-universe-point",
      "verify:provider-real-fs-conformance-result",
      "verify:provider-runtime-attestation-point",
      "verify:provider-feasibility-evidence-point",
      "verify:provider-registry-evidence-binding-point",
      "verify:provider-feasibility-support-catalog-point",
    ];

    expect(providerScripts.prepack).toBe(
      "npm run build && npm run verify:all",
    );
    expect(providerScripts["verify:all"].split(" && ")).toEqual(
      verifierNames.map((name) => `npm run ${name}`),
    );
    expect(providerScripts.test).toBe(
      "pnpm run build && pnpm run typecheck && vitest run --maxWorkers=1 && pnpm run test:distribution",
    );
    expect(providerScripts.test).not.toContain("verify:");
    expect(providerDistributionScript).toMatch(
      /run\(\s*npmCommand,\s*\[\s*"pack",\s*"\.",\s*"--ignore-scripts=false"[\s\S]*?\],\s*\{\s*cwd: cleanPackageRoot,\s*env:\s*\{\s*NODE_OPTIONS:\s*C09_PACK_NODE_OPTIONS\s*\},\s*timeoutMs:\s*PACK_COMMAND_TIMEOUT_MS,?\s*\},\s*\);/,
    );
    expect(contractsDistributionScript).toMatch(
      /run\(\s*pnpmCommand,\s*\["run", "build"\],\s*\{ cwd: cleanProviderRoot \},\s*\);\s*run\(\s*npmCommand,\s*\[\s*"pack",\s*"\.",\s*"--ignore-scripts"[\s\S]*?\],\s*\{ cwd: cleanProviderRoot \},\s*\);/,
    );
  });

  it("cleans stale artifacts and builds foundation packages before their consumers", () => {
    expect(scripts["build:all"]).toBe(
      "pnpm run clean:build && pnpm --filter @understand-code/durable-object-provider-contracts --fail-if-no-match build && pnpm --filter @understand-code/contracts --fail-if-no-match build && pnpm --filter @understand-code/repository-state --fail-if-no-match build && pnpm --filter @understand-code/artifact-store --fail-if-no-match build && pnpm --filter @understand-code/core --fail-if-no-match build && pnpm --filter @understand-code/task-engine --fail-if-no-match build && pnpm --filter @understand-code/cli --fail-if-no-match build && pnpm run build && pnpm --filter @understand-code/dashboard --fail-if-no-match build",
    );
    expect(scripts["clean:build"]).toBe("node scripts/clean-build-artifacts.mjs");
    expect(scripts.test).toMatch(
      /^pnpm --filter @understand-code\/durable-object-provider-contracts --fail-if-no-match build && pnpm --filter @understand-code\/contracts --fail-if-no-match build && pnpm --filter @understand-code\/repository-state --fail-if-no-match build && pnpm --filter @understand-code\/artifact-store --fail-if-no-match build && pnpm --filter @understand-code\/core --fail-if-no-match build && pnpm --filter @understand-code\/task-engine --fail-if-no-match build && /,
    );
    expect(scripts.typecheck).toMatch(
      /^pnpm --filter @understand-code\/durable-object-provider-contracts --fail-if-no-match build && pnpm --filter @understand-code\/contracts --fail-if-no-match build && pnpm --filter @understand-code\/repository-state --fail-if-no-match build && pnpm --filter @understand-code\/artifact-store --fail-if-no-match build && pnpm --filter @understand-code\/core --fail-if-no-match build && pnpm --filter @understand-code\/task-engine --fail-if-no-match build && /,
    );
    expect(scripts.typecheck).toBe(
      "pnpm --filter @understand-code/durable-object-provider-contracts --fail-if-no-match build && pnpm --filter @understand-code/contracts --fail-if-no-match build && pnpm --filter @understand-code/repository-state --fail-if-no-match build && pnpm --filter @understand-code/artifact-store --fail-if-no-match build && pnpm --filter @understand-code/core --fail-if-no-match build && pnpm --filter @understand-code/task-engine --fail-if-no-match build && pnpm --filter @understand-code/durable-object-provider-contracts --fail-if-no-match typecheck && pnpm --filter @understand-code/contracts --fail-if-no-match exec tsc --noEmit && pnpm --filter @understand-code/repository-state --fail-if-no-match exec tsc --noEmit && pnpm --filter @understand-code/artifact-store --fail-if-no-match typecheck && pnpm run typecheck:skill && pnpm --filter @understand-code/core --fail-if-no-match exec tsc --noEmit && pnpm --filter @understand-code/task-engine --fail-if-no-match typecheck && pnpm --filter @understand-code/cli --fail-if-no-match typecheck && pnpm --filter @understand-code/dashboard --fail-if-no-match exec tsc -b --pretty false",
    );
  });

  it("removes orphaned build outputs from every fixed artifact target", async () => {
    expect(BUILD_ARTIFACT_PATHS).toEqual([
      "dist",
      "packages/durable-object-provider-contracts/dist",
      "packages/contracts/dist",
      "packages/repository-state/dist",
      "packages/artifact-store/dist",
      "packages/core/dist",
      "packages/task-engine/dist",
      "packages/cli/dist",
      "packages/dashboard/dist",
      "packages/dashboard/node_modules/.tmp/tsconfig.app.tsBuildInfoFile",
    ]);
    const root = mkdtempSync(join(tmpdir(), "understand-code-quality-"));
    temporaryRoots.push(root);
    for (const relativePath of BUILD_ARTIFACT_PATHS) {
      const artifactDirectory = relativePath.includes(".tsBuildInfoFile")
        ? relativePath.slice(0, relativePath.lastIndexOf("/"))
        : relativePath;
      mkdirSync(join(root, artifactDirectory), { recursive: true });
      const orphanPath = relativePath.includes(".tsBuildInfoFile")
        ? join(root, relativePath)
        : join(root, relativePath, "orphan-output.js");
      writeFileSync(orphanPath, "stale");
    }

    await cleanBuildArtifacts(root);

    for (const relativePath of BUILD_ARTIFACT_PATHS) {
      expect(existsSync(join(root, relativePath))).toBe(false);
    }
  });

  it("keeps all declared workspace packages in every root quality phase", () => {
    const packagesDirectory = fileURLToPath(new URL("../../packages", import.meta.url));
    const workspacePackageNames = readdirSync(packagesDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const manifestPath = join(packagesDirectory, entry.name, "package.json");
        return existsSync(manifestPath)
          ? JSON.parse(readFileSync(manifestPath, "utf8")).name
          : null;
      })
      .filter((name) => typeof name === "string");

    expect(workspacePackageNames.length).toBeGreaterThan(0);
    for (const packageName of workspacePackageNames) {
      expect(scripts["build:all"]).toContain(packageName);
      expect(scripts.typecheck).toContain(packageName);
      expect(scripts.test).toContain(packageName);
    }
    for (const scriptName of ["build:all", "typecheck", "test", "quality"]) {
      expect(scripts[scriptName]).not.toMatch(/\|\||;\s*(?:true|exit\s+0)/);
    }
  });

  it("discovers maintained tests in both current and legacy root locations", () => {
    expect(vitestConfig).toContain("'src/**/*.test.{ts,tsx,mjs}'");
    expect(vitestConfig).toContain("'tests/**/*.test.{ts,tsx,mjs}'");
  });
});
