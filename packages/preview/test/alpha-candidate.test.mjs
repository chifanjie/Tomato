import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = path.resolve(packageRoot, "../..");
const candidateScript = "packages/preview/scripts/alpha-candidate.mjs";
const candidateManifestFile = "understand-code-alpha-candidate.json";
const candidateSchemaFile = "understand-code-alpha-candidate-v1.schema.json";
const checksumFile = "SHA256SUMS";
const overlayFiles = [
  "packages/preview/package.json",
  "packages/preview/README.md",
  candidateScript,
  "packages/preview/schemas/alpha-candidate-v1.schema.json",
];

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function exactKeys(value, expected, label) {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
}

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd ?? sourceRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: options.timeout ?? 10 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

function sanitizedGitEnvironment() {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  return {
    ...environment,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_COUNT: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
  };
}

async function runGit(args, options = {}) {
  return run(
    "git",
    [
      "--no-pager",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "core.fsmonitor=false",
      ...args,
    ],
    {
      ...options,
      env: sanitizedGitEnvironment(),
      timeout: options.timeout ?? 30_000,
    },
  );
}

async function runCandidate(scriptPath, operation, candidatePath, options = {}) {
  const flag = operation === "assemble" ? "--output" : "--candidate";
  const result = await run(
    process.execPath,
    [scriptPath, operation, flag, candidatePath],
    options,
  );
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output, {
    ok: true,
    operation,
    disposition: "unsigned_alpha_candidate",
    releaseReady: false,
  });
  return output;
}

async function expectVerificationFailure(scriptPath, candidatePath, options) {
  await assert.rejects(
    run(
      process.execPath,
      [scriptPath, "verify", "--candidate", candidatePath],
      options,
    ),
    (error) => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, "");
      assert.equal(error.stderr, "alpha-candidate: verification_failed\n");
      return true;
    },
  );
}

async function expectAssemblyFailure(scriptPath, candidatePath, options) {
  await assert.rejects(
    run(
      process.execPath,
      [scriptPath, "assemble", "--output", candidatePath],
      options,
    ),
    (error) => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, "");
      assert.equal(error.stderr, "alpha-candidate: verification_failed\n");
      return true;
    },
  );
}

async function tarEntry(tarballPath, entry, cwd) {
  const result = await run("tar", ["-xOf", tarballPath, entry], { cwd });
  return Buffer.from(result.stdout, "utf8");
}

function singleBitTamper(bytes, needle) {
  const tampered = Buffer.from(bytes);
  const offset = needle === undefined
    ? Math.max(0, Math.floor(tampered.byteLength / 2))
    : tampered.indexOf(Buffer.from(needle, "utf8"));
  assert.ok(offset >= 0 && offset < tampered.byteLength, "tamper target must exist");
  tampered[offset] ^= 0x01;
  return tampered;
}

test("assembles and verifies one unsigned Alpha candidate from an exact clean source", { timeout: 15 * 60 * 1000 }, async () => {
  const temporaryParent = await realpath(
    await mkdtemp(path.join(tmpdir(), "uc-alpha-candidate-e2e-")),
  );
  const worktreeRoot = path.join(temporaryParent, "source");
  const candidateRoot = path.join(temporaryParent, "candidate");
  const secret = "alpha-candidate-secret-must-not-leak-7ccfca92";
  try {
    const sourceHead = (await runGit(["rev-parse", "--verify", "HEAD^{commit}"], {
      cwd: sourceRoot,
    })).stdout.trim();
    await runGit(
      ["clone", "--no-local", "--no-checkout", "--no-tags", sourceRoot, worktreeRoot],
      { cwd: temporaryParent, timeout: 2 * 60 * 1000 },
    );
    await runGit(["checkout", "--detach", sourceHead], { cwd: worktreeRoot });
    for (const relativePath of overlayFiles) {
      const destination = path.join(worktreeRoot, relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(path.join(sourceRoot, relativePath), destination);
    }
    await runGit(["add", "--", ...overlayFiles], { cwd: worktreeRoot });
    await runGit(
      [
        "-c",
        "user.name=Understand Code Candidate Test",
        "-c",
        "user.email=alpha-candidate@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "test unsigned Alpha candidate source",
      ],
      { cwd: worktreeRoot },
    );
    const sourceCommit = (await runGit(["rev-parse", "HEAD"], {
      cwd: worktreeRoot,
    })).stdout.trim();
    const sourceTree = (await runGit(["rev-parse", "HEAD^{tree}"], {
      cwd: worktreeRoot,
    })).stdout.trim();
    assert.equal(
      (await runGit(["status", "--porcelain=v1", "--untracked-files=all"], {
        cwd: worktreeRoot,
      })).stdout,
      "",
      "the assembler source must be an exact clean commit",
    );

    const commandEnvironment = {
      ...process.env,
      CI: "true",
      VITE_GRAPH_URL: secret,
    };
    await run(
      "pnpm",
      ["install", "--offline", "--frozen-lockfile"],
      { cwd: worktreeRoot, env: commandEnvironment },
    );
    const scriptPath = path.join(worktreeRoot, candidateScript);
    const viteEnvironmentPath = path.join(
      worktreeRoot,
      "packages/dashboard/.env.local",
    );
    await writeFile(viteEnvironmentPath, "VITE_GRAPH_URL=/knowledge-graph.json\n");
    await expectAssemblyFailure(scriptPath, candidateRoot, {
      cwd: worktreeRoot,
      env: commandEnvironment,
    });
    await assert.rejects(readdir(candidateRoot), { code: "ENOENT" });
    await rm(viteEnvironmentPath);
    await runCandidate(scriptPath, "assemble", candidateRoot, {
      cwd: worktreeRoot,
      env: commandEnvironment,
    });

    const names = (await readdir(candidateRoot)).sort();
    const tarballs = names.filter((name) => name.endsWith(".tgz"));
    assert.equal(tarballs.length, 1);
    assert.deepEqual(names, [
      checksumFile,
      candidateManifestFile,
      candidateSchemaFile,
      tarballs[0],
    ].sort());
    const tarballFile = tarballs[0];
    const tarballPath = path.join(candidateRoot, tarballFile);
    const manifestPath = path.join(candidateRoot, candidateManifestFile);
    const schemaPath = path.join(candidateRoot, candidateSchemaFile);
    const checksumPath = path.join(candidateRoot, checksumFile);
    const [tarballBytes, manifestBytes, schemaBytes, checksumBytes] =
      await Promise.all([
        readFile(tarballPath),
        readFile(manifestPath),
        readFile(schemaPath),
        readFile(checksumPath),
      ]);
    const candidate = JSON.parse(manifestBytes.toString("utf8"));
    exactKeys(candidate, [
      "schemaVersion",
      "disposition",
      "releaseReady",
      "package",
      "subject",
      "embeddedReleaseManifest",
      "source",
      "build",
      "gates",
      "limitations",
    ], "candidate manifest keys");
    assert.equal(candidate.schemaVersion, "understand-code-alpha-candidate-v1");
    assert.equal(candidate.disposition, "unsigned_alpha_candidate");
    assert.equal(candidate.releaseReady, false);
    assert.deepEqual(candidate.limitations, {
      signature: "unavailable",
      sbom: "unavailable",
      trustedProvenance: "unavailable",
      crossPlatform: "not_evaluated",
    });
    assert.equal(candidate.source.clean, true);
    assert.equal(candidate.source.commit, sourceCommit);
    assert.equal(candidate.source.tree, sourceTree);
    assert.deepEqual(candidate.subject, {
      file: tarballFile,
      mediaType: "application/vnd.npm.package+gzip",
      bytes: tarballBytes.byteLength,
      sha256: sha256(tarballBytes),
    });
    assert.deepEqual(candidate.gates, {
      coldPacked: "passed",
      checksum: "passed",
    });
    assert.equal(
      candidate.build.nativeTuple,
      `${candidate.build.platform}-${candidate.build.arch}`,
    );

    const schema = JSON.parse(schemaBytes.toString("utf8"));
    exactKeys(schema, [
      "$schema",
      "$id",
      "title",
      "type",
      "additionalProperties",
      "required",
      "properties",
    ], "candidate schema keys");
    assert.equal(schema.additionalProperties, false);
    assert.equal(
      schema.properties.schemaVersion.const,
      "understand-code-alpha-candidate-v1",
    );
    assert.deepEqual(
      [...schema.required].sort(),
      Object.keys(candidate).sort(),
      "the reviewed schema must require every candidate field",
    );
    const versionPattern = "^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$";
    assert.deepEqual(schema.properties.package.properties.version, {
      type: "string",
      minLength: 1,
      maxLength: 64,
      pattern: versionPattern,
    });
    assert.equal(
      schema.properties.subject.properties.bytes.maximum,
      32 * 1024 * 1024,
    );
    for (const key of ["platform", "arch", "nativeTuple", "node", "npm", "pnpm"]) {
      const property = schema.properties.build.properties[key];
      assert.equal(property.maxLength, 64, `${key} must be length-bounded`);
      assert.equal(property.pattern, versionPattern, `${key} must use the safe pattern`);
    }
    assert.equal(
      schema.properties.build.properties.nativeTuple.$comment,
      "The runtime verifier additionally requires nativeTuple to equal platform + '-' + arch.",
    );
    assert.deepEqual(schema.properties.source.allOf, [
      {
        if: {
          properties: { objectFormat: { const: "sha1" } },
          required: ["objectFormat"],
        },
        then: {
          properties: {
            commit: { pattern: "^[0-9a-f]{40}$" },
            tree: { pattern: "^[0-9a-f]{40}$" },
            lockfile: {
              properties: {
                objectId: { pattern: "^[0-9a-f]{40}$" },
              },
            },
          },
        },
      },
      {
        if: {
          properties: { objectFormat: { const: "sha256" } },
          required: ["objectFormat"],
        },
        then: {
          properties: {
            commit: { pattern: "^[0-9a-f]{64}$" },
            tree: { pattern: "^[0-9a-f]{64}$" },
            lockfile: {
              properties: {
                objectId: { pattern: "^[0-9a-f]{64}$" },
              },
            },
          },
        },
      },
    ]);
    assert.deepEqual(
      schemaBytes,
      await readFile(path.join(worktreeRoot, overlayFiles[3])),
      "the candidate must copy the exact reviewed schema bytes",
    );

    const checksumLines = checksumBytes.toString("utf8").trimEnd().split("\n");
    assert.deepEqual(checksumLines, [
      [candidateManifestFile, manifestBytes],
      [candidateSchemaFile, schemaBytes],
      [tarballFile, tarballBytes],
    ].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(
      ([file, bytes]) => `${sha256(bytes).slice("sha256:".length)}  ${file}`,
    ));

    const [packedPackageBytes, releaseManifestBytes] = await Promise.all([
      tarEntry(tarballPath, "package/package.json", worktreeRoot),
      tarEntry(
        tarballPath,
        "package/dist/release-manifest.json",
        worktreeRoot,
      ),
    ]);
    const packedPackage = JSON.parse(packedPackageBytes.toString("utf8"));
    const releaseManifest = JSON.parse(releaseManifestBytes.toString("utf8"));
    assert.deepEqual(candidate.package, {
      name: packedPackage.name,
      version: packedPackage.version,
    });
    assert.equal(releaseManifest.schemaVersion, "understand-code-alpha-release-v1");
    assert.equal(releaseManifest.package.name, candidate.package.name);
    assert.equal(releaseManifest.package.version, candidate.package.version);
    assert.equal(releaseManifest.native.tuple, candidate.build.nativeTuple);
    assert.deepEqual(candidate.embeddedReleaseManifest, {
      path: "package/dist/release-manifest.json",
      schemaVersion: releaseManifest.schemaVersion,
      sha256: sha256(releaseManifestBytes),
    });

    const expandedTarball = gunzipSync(tarballBytes, {
      maxOutputLength: 20 * 1024 * 1024,
    });
    for (const forbidden of [sourceRoot, temporaryParent, secret]) {
      const marker = Buffer.from(forbidden, "utf8");
      assert.equal(manifestBytes.includes(marker), false);
      assert.equal(schemaBytes.includes(marker), false);
      assert.equal(checksumBytes.includes(marker), false);
      assert.equal(tarballBytes.includes(marker), false);
      assert.equal(expandedTarball.includes(marker), false);
    }

    await runCandidate(scriptPath, "verify", candidateRoot, {
      cwd: worktreeRoot,
      env: commandEnvironment,
    });
    const tamperCases = [
      { path: tarballPath, bytes: tarballBytes, needle: undefined },
      {
        path: manifestPath,
        bytes: manifestBytes,
        needle: "unsigned_alpha_candidate",
      },
      {
        path: schemaPath,
        bytes: schemaBytes,
        needle: "Understand Code unsigned Alpha candidate",
      },
      {
        path: checksumPath,
        bytes: checksumBytes,
        needle: tarballFile,
      },
    ];
    for (const tamper of tamperCases) {
      await writeFile(
        tamper.path,
        singleBitTamper(tamper.bytes, tamper.needle),
      );
      await expectVerificationFailure(scriptPath, candidateRoot, {
        cwd: worktreeRoot,
        env: commandEnvironment,
      });
      await writeFile(tamper.path, tamper.bytes);
      await runCandidate(scriptPath, "verify", candidateRoot, {
        cwd: worktreeRoot,
        env: commandEnvironment,
      });
    }
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
  }
});
