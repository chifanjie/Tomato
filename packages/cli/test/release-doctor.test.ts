import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
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
  const sha256 = (bytes: Buffer): `sha256:${string}` =>
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const artifactRoot = path.join(root, ".understand-code");
  const sourceFiles = [
    [
      "knowledge-base/search-index.json",
      "packages/contracts/fixtures/v1/legacy/wiki-search-v2.json",
    ],
    [
      "knowledge-base/wiki-index.json",
      "packages/contracts/fixtures/v1/legacy/wiki-index-v2.json",
    ],
    [
      "knowledge-graph.json",
      "packages/contracts/fixtures/v1/legacy/graph-v1.json",
    ],
  ] as const;
  const files = await Promise.all(sourceFiles.map(async ([relative, fixture]) => ({
    path: relative,
    bytes: await readFile(path.join(workspaceRoot, fixture)),
  })));
  const sourceInventoryDigest = `sha256:${"1".repeat(64)}` as const;
  const generationSeed = {
    schemaVersion: 1,
    sourceInventoryDigest,
    files: files.map((file) => ({
      path: file.path,
      contentDigest: sha256(file.bytes),
    })),
  };
  const generationId = `generation-${sha256(Buffer.from(
    JSON.stringify(generationSeed),
  )).slice(7)}`;
  const generationManifest = { ...generationSeed, generationId };
  const generationManifestBytes = Buffer.from(
    `${JSON.stringify(generationManifest, null, 2)}\n`,
  );
  const generationRoot = path.join(
    artifactRoot,
    "index-generations-v1",
    generationId,
  );
  await mkdir(path.join(generationRoot, "knowledge-base"), {
    recursive: true,
    mode: 0o700,
  });
  await Promise.all(files.map((file) => writeFile(
    path.join(generationRoot, file.path),
    file.bytes,
    { mode: 0o600 },
  )));
  await writeFile(
    path.join(generationRoot, "generation-manifest.json"),
    generationManifestBytes,
    { mode: 0o600 },
  );
  await writeFile(
    path.join(artifactRoot, "index-active-v1.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      generationId,
      generationManifestDigest: sha256(generationManifestBytes),
      sourceInventoryDigest,
      sourceSnapshotId: "snapshot:actual",
      finalizedProviderRevision: 2,
    }, null, 2)}\n`,
    { mode: 0o600 },
  );
  await Promise.all([
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
