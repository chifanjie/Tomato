import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const temporaryRoots = new Set<string>();

export function temporaryDirectory(label = "repo-state"): string {
  const root = mkdtempSync(join(tmpdir(), `${label}-`));
  temporaryRoots.add(root);
  return root;
}

export function cleanupTemporaryDirectories(): void {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  temporaryRoots.clear();
}

export function git(
  cwd: string,
  args: readonly string[],
  options: { allowFailure?: boolean } = {},
): string {
  try {
    return execFileSync("git", [...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
      },
    }).trim();
  } catch (error) {
    if (options.allowFailure) return "";
    throw error;
  }
}

export function writeRepositoryFile(
  root: string,
  path: string,
  content: string,
): void {
  const segments = path.split("/");
  const parent = join(root, ...segments.slice(0, -1));
  mkdirSync(parent, { recursive: true });
  writeFileSync(join(root, ...segments), content);
}

export function initializeRepository(
  initialFiles: Readonly<Record<string, string>> = {
    "src/main.ts": "export const value = 1;\n",
  },
): string {
  const parent = temporaryDirectory();
  const root = join(parent, "repository");
  mkdirSync(root);
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.name", "Repository State Tests"]);
  git(root, ["config", "user.email", "repository-state@example.invalid"]);
  for (const [path, content] of Object.entries(initialFiles)) {
    writeRepositoryFile(root, path, content);
  }
  git(root, ["add", "--all"]);
  git(root, ["commit", "-q", "-m", "initial"]);
  return root;
}

export function commitAll(root: string, message: string): string {
  git(root, ["add", "--all"]);
  git(root, ["commit", "-q", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}
