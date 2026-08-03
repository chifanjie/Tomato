import { execFile } from "node:child_process";
import { stat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { WorkspaceBindingReasonV1 } from "@understand-code/contracts/mcp";

import { MAX_ROOTS } from "../constants.js";

const execFileAsync = promisify(execFile);

export type InitialBinding =
  | { readonly kind: "bound"; readonly canonicalRoot: string }
  | { readonly kind: "binding_error"; readonly reason: WorkspaceBindingReasonV1 };

type CandidateResult =
  | { readonly kind: "bound"; readonly canonicalRoot: string }
  | { readonly kind: "not_directory" }
  | { readonly kind: "unavailable" };

function gitEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  ]) {
    delete environment[name];
  }
  environment.GIT_OPTIONAL_LOCKS = "0";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.LC_ALL = "C";
  return environment;
}

async function canonicalizeExplicitRoot(root: string): Promise<CandidateResult> {
  if (!path.isAbsolute(root)) return { kind: "unavailable" };
  let canonicalInput: string;
  try {
    const metadata = await stat(root);
    if (!metadata.isDirectory()) return { kind: "not_directory" };
    canonicalInput = await realpath(root);
  } catch {
    return { kind: "unavailable" };
  }

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--show-toplevel"],
      {
        cwd: canonicalInput,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        env: gitEnvironment(),
      },
    );
    const topLevel = stdout.trim();
    if (
      topLevel.length === 0 ||
      !path.isAbsolute(topLevel) ||
      /[\u0000\r\n]/u.test(topLevel)
    ) {
      return { kind: "unavailable" };
    }
    const canonicalRoot = await realpath(topLevel);
    const metadata = await stat(canonicalRoot);
    if (!metadata.isDirectory()) return { kind: "not_directory" };
    if (canonicalRoot !== canonicalInput) return { kind: "unavailable" };
    return { kind: "bound", canonicalRoot };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function resolveInitialBinding(
  rootCandidates: readonly string[],
): Promise<InitialBinding> {
  if (rootCandidates.length === 0) {
    return { kind: "binding_error", reason: "root_missing" };
  }
  if (rootCandidates.length > 1) {
    return { kind: "binding_error", reason: "root_conflict" };
  }

  const nonEmpty = rootCandidates.filter((candidate) => candidate.length > 0);
  const results = await Promise.all(nonEmpty.map(canonicalizeExplicitRoot));
  const canonicalRoots = new Set(
    results
      .filter((result): result is Extract<CandidateResult, { kind: "bound" }> =>
        result.kind === "bound",
      )
      .map((result) => result.canonicalRoot),
  );
  if (canonicalRoots.size > 1) {
    return { kind: "binding_error", reason: "root_conflict" };
  }
  if (nonEmpty.length !== rootCandidates.length) {
    return { kind: "binding_error", reason: "root_missing" };
  }
  if (results.some((result) => result.kind === "not_directory")) {
    return { kind: "binding_error", reason: "root_not_directory" };
  }
  if (results.some((result) => result.kind === "unavailable")) {
    return { kind: "binding_error", reason: "root_unavailable" };
  }
  const canonicalRoot = canonicalRoots.values().next().value as string | undefined;
  return canonicalRoot === undefined
    ? { kind: "binding_error", reason: "root_unavailable" }
    : { kind: "bound", canonicalRoot };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function pathContains(ancestor: string, candidate: string): boolean {
  const relative = path.relative(ancestor, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

async function canonicalAdvertisedRoot(value: unknown): Promise<string> {
  if (!isPlainObject(value) || typeof value.uri !== "string") {
    throw new Error("invalid_root");
  }
  const parsed = new URL(value.uri);
  if (
    parsed.protocol !== "file:" ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new Error("invalid_root");
  }
  const decoded = fileURLToPath(parsed);
  const metadata = await stat(decoded);
  if (!metadata.isDirectory()) throw new Error("invalid_root");
  return realpath(decoded);
}

export class RootBindingSession {
  readonly #canonicalRoot?: string;
  #errorReason?: WorkspaceBindingReasonV1;
  #rootsAdvertised = false;
  #membershipVerified = false;
  #membershipPending = false;

  constructor(initial: InitialBinding) {
    if (initial.kind === "bound") this.#canonicalRoot = initial.canonicalRoot;
    else this.#errorReason = initial.reason;
  }

  configureClientRoots(advertised: boolean): void {
    this.#rootsAdvertised = advertised;
    this.#membershipVerified = !advertised;
    this.#membershipPending = advertised;
  }

  get rootsAdvertised(): boolean {
    return this.#rootsAdvertised;
  }

  get errorReason(): WorkspaceBindingReasonV1 | undefined {
    return this.#errorReason;
  }

  requireCanonicalRoot(): InitialBinding {
    if (this.#errorReason !== undefined) {
      return { kind: "binding_error", reason: this.#errorReason };
    }
    if (this.#canonicalRoot === undefined) {
      this.#errorReason = "root_unavailable";
      return { kind: "binding_error", reason: this.#errorReason };
    }
    if (
      this.#rootsAdvertised &&
      (this.#membershipPending || !this.#membershipVerified)
    ) {
      return { kind: "binding_error", reason: "root_unavailable" };
    }
    return { kind: "bound", canonicalRoot: this.#canonicalRoot };
  }

  lockError(reason: WorkspaceBindingReasonV1): void {
    if (this.#errorReason === undefined) this.#errorReason = reason;
    this.#membershipPending = false;
    this.#membershipVerified = false;
  }

  beginRootsValidation(): void {
    if (!this.#rootsAdvertised || this.#errorReason !== undefined) return;
    this.#membershipPending = true;
    this.#membershipVerified = false;
  }

  async applyRootsResult(value: unknown): Promise<void> {
    if (this.#errorReason !== undefined || this.#canonicalRoot === undefined) return;
    if (
      !isPlainObject(value) ||
      !Array.isArray(value.roots) ||
      value.roots.length > MAX_ROOTS
    ) {
      this.lockError("root_unavailable");
      return;
    }
    let roots: string[];
    try {
      roots = await Promise.all(value.roots.map(canonicalAdvertisedRoot));
    } catch {
      this.lockError("root_unavailable");
      return;
    }
    if (!roots.some((root) => pathContains(root, this.#canonicalRoot!))) {
      this.lockError("root_not_allowed");
      return;
    }
    this.#membershipVerified = true;
    this.#membershipPending = false;
  }
}
