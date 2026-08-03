import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { ArtifactStore, sha256CanonicalJson } from "@understand-code/artifact-store";
import {
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
} from "@understand-code/contracts";
import { buildRepoPulse, getRepositorySnapshotDetailed } from "@understand-code/repository-state";

const execFileAsync = promisify(execFile);
const PRODUCT_VERSION = "0.1.0";

export const temporaryDirectories: string[] = [];

export async function cleanupTemporaryDirectories(): Promise<void> {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
}

export async function createTemporaryDirectory(prefix: string): Promise<string> {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

export async function git(root: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync("git", [...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Understand Code Test",
      GIT_AUTHOR_EMAIL: "test@example.invalid",
      GIT_COMMITTER_NAME: "Understand Code Test",
      GIT_COMMITTER_EMAIL: "test@example.invalid",
    },
  });
  return result.stdout;
}

export async function createGitRepository(options: { seedArtifacts?: boolean } = {}): Promise<string> {
  const root = await createTemporaryDirectory("understand-code-cli-");
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "src/task.ts"),
    "export function task(): boolean { return true; }\n",
    "utf8",
  );
  await git(root, ["init", "-q"]);
  await git(root, ["add", "src/task.ts"]);
  await git(root, ["commit", "-q", "-m", "fixture"]);
  if (options.seedArtifacts !== false) await seedPublishedContext(root);
  return root;
}

export async function seedPublishedContext(root: string): Promise<void> {
  const capture = await getRepositorySnapshotDetailed(root, {
    now: () => new Date("2026-08-03T00:00:00.000Z"),
  });
  if (capture.snapshot.captureStatus !== "complete") {
    throw new Error("Fixture repository capture was not complete.");
  }
  const store = await ArtifactStore.open(root, {
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    producerVersion: PRODUCT_VERSION,
    clock: () => new Date("2026-08-03T00:00:00.000Z"),
  });
  await store.initialize();
  const graph = {
    version: "1",
    project: {
      name: "cli-fixture",
      languages: ["TypeScript"],
      frameworks: [],
      description: "CLI integration fixture",
      analyzedAt: "2026-08-03T00:00:00.000Z",
      gitCommitHash: capture.snapshot.headCommit!,
    },
    nodes: [
      {
        id: "function:task",
        type: "function",
        name: "task",
        filePath: "src/task.ts",
        lineRange: [1, 1],
        summary: "Returns the current task state.",
        tags: ["task"],
        complexity: "simple",
      },
    ],
    edges: [],
    layers: [],
    tour: [],
  };
  await writeFile(
    path.join(root, ".understand-code/knowledge-graph.json"),
    `${JSON.stringify(graph)}\n`,
    "utf8",
  );
  const pulse = buildRepoPulse({
    snapshot: capture.snapshot,
    git: capture.git,
    artifacts: {
      graph: "fresh",
      wiki: "fresh",
      evidence: "fresh",
      diff: "fresh",
      task: "fresh",
    },
    completeness: {
      parser: { status: "complete", coverage: 1, reasons: [] },
      callGraph: { status: "complete", coverage: 1, reasons: [] },
    },
    evaluatedAt: "2026-08-03T00:00:00.000Z",
  });
  const snapshotArtifact = RepositorySnapshotArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repository_snapshot",
    artifactId: `artifact:repository-snapshot:${capture.snapshot.snapshotId}`,
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    sourceSnapshotId: capture.snapshot.snapshotId,
    revision: 0,
    producerVersion: PRODUCT_VERSION,
    createdAt: capture.snapshot.createdAt,
    contentDigest: sha256CanonicalJson(capture.snapshot),
    payload: capture.snapshot,
  });
  const pulseArtifact = RepoPulseArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repo_pulse",
    artifactId: `artifact:repo-pulse:${capture.snapshot.snapshotId}`,
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    sourceSnapshotId: capture.snapshot.snapshotId,
    revision: 0,
    producerVersion: PRODUCT_VERSION,
    createdAt: pulse.evaluatedAt,
    contentDigest: sha256CanonicalJson(pulse),
    payload: pulse,
  });
  await store.persistArtifact(snapshotArtifact);
  await store.persistArtifact(pulseArtifact);
}

export function writeMessage(
  child: ChildProcessWithoutNullStreams,
  message: unknown,
): void {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

export function collectJsonLines(child: ChildProcessWithoutNullStreams): {
  readonly messages: unknown[];
  readonly stdout: string[];
  readonly stderr: string[];
  readonly waitFor: (predicate: (message: any) => boolean) => Promise<any>;
} {
  const messages: unknown[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const waiters: {
    predicate: (message: any) => boolean;
    resolve: (message: any) => void;
  }[] = [];
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => stdout.push(chunk));
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    messages.push(message);
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(message)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => stderr.push(chunk));
  return {
    messages,
    stdout,
    stderr,
    waitFor(predicate) {
      const existing = messages.find((message) => predicate(message));
      if (existing !== undefined) return Promise.resolve(existing);
      return new Promise((resolve) => waiters.push({ predicate, resolve }));
    },
  };
}

export async function readSourceFixture(root: string): Promise<string> {
  return readFile(path.join(root, "src/task.ts"), "utf8");
}

export async function snapshotRepositoryFiles(
  root: string,
): Promise<Readonly<Record<string, string>>> {
  const snapshot: Record<string, string> = {};
  const walk = async (relativeDirectory: string): Promise<void> => {
    const absoluteDirectory =
      relativeDirectory.length === 0
        ? root
        : path.join(root, ...relativeDirectory.split("/"));
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const relativePath =
        relativeDirectory.length === 0
          ? entry.name
          : `${relativeDirectory}/${entry.name}`;
      const firstComponent = relativePath.split("/", 1)[0];
      if (firstComponent === ".git" || firstComponent === ".understand-code") {
        continue;
      }
      const absolutePath = path.join(root, ...relativePath.split("/"));
      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (entry.isFile()) {
        const bytes = await readFile(absolutePath);
        snapshot[relativePath] = `file:sha256:${createHash("sha256")
          .update(bytes)
          .digest("hex")}`;
      } else if (entry.isSymbolicLink()) {
        const target = await readlink(absolutePath, "buffer");
        snapshot[relativePath] = `symlink:sha256:${createHash("sha256")
          .update(target)
          .digest("hex")}`;
      } else {
        snapshot[relativePath] = "special";
      }
    }
  };
  await walk("");
  return Object.freeze(snapshot);
}
