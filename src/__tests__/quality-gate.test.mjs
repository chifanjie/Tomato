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
      "pnpm --filter @understand-code/contracts --fail-if-no-match test",
    );
    expect(scripts.test).toContain(
      "pnpm --filter @understand-code/repository-state --fail-if-no-match test",
    );
    expect(scripts.test).toContain(
      "pnpm --filter @understand-code/core --fail-if-no-match test",
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

  it("cleans stale artifacts and builds foundation packages before their consumers", () => {
    expect(scripts["build:all"]).toBe(
      "pnpm run clean:build && pnpm --filter @understand-code/contracts --fail-if-no-match build && pnpm --filter @understand-code/repository-state --fail-if-no-match build && pnpm --filter @understand-code/core --fail-if-no-match build && pnpm run build && pnpm --filter @understand-code/dashboard --fail-if-no-match build",
    );
    expect(scripts["clean:build"]).toBe("node scripts/clean-build-artifacts.mjs");
    expect(scripts.test).toMatch(
      /^pnpm --filter @understand-code\/contracts --fail-if-no-match build && pnpm --filter @understand-code\/repository-state --fail-if-no-match build && pnpm --filter @understand-code\/core --fail-if-no-match build && /,
    );
    expect(scripts.typecheck).toMatch(
      /^pnpm --filter @understand-code\/contracts --fail-if-no-match build && pnpm --filter @understand-code\/repository-state --fail-if-no-match build && pnpm --filter @understand-code\/core --fail-if-no-match build && /,
    );
    expect(scripts.typecheck).toBe(
      "pnpm --filter @understand-code/contracts --fail-if-no-match build && pnpm --filter @understand-code/repository-state --fail-if-no-match build && pnpm --filter @understand-code/core --fail-if-no-match build && pnpm --filter @understand-code/contracts --fail-if-no-match exec tsc --noEmit && pnpm --filter @understand-code/repository-state --fail-if-no-match exec tsc --noEmit && pnpm run typecheck:skill && pnpm --filter @understand-code/core --fail-if-no-match exec tsc --noEmit && pnpm --filter @understand-code/dashboard --fail-if-no-match exec tsc -b --pretty false",
    );
  });

  it("removes orphaned build outputs from every fixed artifact target", async () => {
    expect(BUILD_ARTIFACT_PATHS).toEqual([
      "dist",
      "packages/contracts/dist",
      "packages/repository-state/dist",
      "packages/core/dist",
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
