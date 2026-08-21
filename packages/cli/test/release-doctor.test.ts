import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  runReleaseDoctorV1,
  type ReleaseDoctorCheckIdV1,
  type ReleaseDoctorResultV1,
} from "../src/release-doctor.js";
import {
  cleanupTemporaryDirectories,
  createGitRepository,
  createTemporaryDirectory,
} from "./helpers.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(packageRoot, "../..");

const expectedCheckIds = [
  "node_runtime",
  "git",
  "repository_root",
  "artifact_schema",
  "loopback_port",
  "package_metadata",
  "release_manifest",
  "bundle_integrity",
  "native_tuple",
  "codex_plugin_payload",
  "claude_plugin_payload",
  "release_authenticity",
  "provider_strong_writes",
] as const satisfies readonly ReleaseDoctorCheckIdV1[];

afterEach(cleanupTemporaryDirectories);

async function seedSchemaValidArtifacts(root: string): Promise<void> {
  const knowledgeBaseRoot = path.join(
    root,
    ".understand-code/knowledge-base",
  );
  await mkdir(knowledgeBaseRoot, { recursive: true });
  await Promise.all([
    copyFile(
      path.join(
        workspaceRoot,
        "packages/contracts/fixtures/v1/legacy/graph-v1.json",
      ),
      path.join(root, ".understand-code/knowledge-graph.json"),
    ),
    copyFile(
      path.join(
        workspaceRoot,
        "packages/contracts/fixtures/v1/legacy/wiki-index-v2.json",
      ),
      path.join(knowledgeBaseRoot, "wiki-index.json"),
    ),
    copyFile(
      path.join(
        workspaceRoot,
        "packages/contracts/fixtures/v1/legacy/wiki-search-v2.json",
      ),
      path.join(knowledgeBaseRoot, "search-index.json"),
    ),
    copyFile(
      path.join(
        workspaceRoot,
        "packages/contracts/fixtures/v1/reference/repo-pulse.json",
      ),
      path.join(root, ".understand-code/repo-pulse.json"),
    ),
  ]);
}

function check(
  result: ReleaseDoctorResultV1,
  id: ReleaseDoctorCheckIdV1,
) {
  const found = result.checks.find((candidate) => candidate.id === id);
  expect(found, `missing Release Doctor check ${id}`).toBeDefined();
  return found!;
}

describe("Release Doctor", () => {
  it("reports a missing release manifest without exposing local paths", async () => {
    const repositoryRoot = await createGitRepository({ seedArtifacts: false });
    await seedSchemaValidArtifacts(repositoryRoot);
    const incompletePackageRoot = await createTemporaryDirectory(
      "understand-code-release-doctor-package-",
    );
    await writeFile(
      path.join(incompletePackageRoot, "package.json"),
      `${JSON.stringify({
        name: "@understand-code/preview",
        version: "0.1.0",
        type: "module",
        engines: { node: ">=22" },
        bin: {
          "understand-code-preview": "dist/bin.mjs",
          "understand-code": "dist/understand-code.mjs",
          "understand-code-codex": "dist/host-bin.mjs",
          "understand-code-claude": "dist/host-bin.mjs",
        },
      })}\n`,
      "utf8",
    );

    const result = await runReleaseDoctorV1({
      packageRoot: incompletePackageRoot,
      repositoryRoot,
    });

    expect(result).toMatchObject({
      schemaVersion: "understand-code-release-doctor-v1",
      product: "understand-code",
      version: "0.1.0",
      readiness: "alpha",
      releaseReady: false,
      strongWrites: "locked",
      hostRegistration: "not_checked",
      ok: false,
      status: "unhealthy",
    });
    expect(result.checks.map(({ id }) => id)).toEqual(expectedCheckIds);
    expect(check(result, "repository_root").status).toBe("pass");
    expect(check(result, "artifact_schema").status).toBe("pass");
    expect(check(result, "loopback_port").status).toBe("pass");
    expect(check(result, "package_metadata").status).toBe("pass");
    expect(check(result, "release_manifest")).toMatchObject({
      status: "fail",
      code: "release_manifest_invalid",
    });
    expect(check(result, "release_manifest").remediation).toMatch(
      /reinstall @understand-code\/preview/iu,
    );
    expect(check(result, "release_authenticity").status).toBe("locked");
    expect(check(result, "provider_strong_writes")).toMatchObject({
      status: "locked",
      code: "provider_strong_writes_locked",
    });

    const publicBytes = JSON.stringify(result);
    expect(publicBytes).not.toContain(repositoryRoot);
    expect(publicBytes).not.toContain(incompletePackageRoot);
  });
});
