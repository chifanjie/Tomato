import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify, TextDecoder } from "node:util";
import type { ArtifactStore } from "@understand-code/artifact-store";
import { DiffHunkEvidenceV1Schema, type PersistedEvidenceV1, type RepositorySnapshotPersistedPayloadV1 } from "@understand-code/contracts";
import { isSensitiveRepositoryPath, readStableRepositoryFile } from "@understand-code/repository-state";
import type { WorkbenchEvidenceReadyV1 } from "@understand-code/workbench-runtime";
import { readRepositoryIndexSourceV1 } from "../runtime/repository-indexer.js";

const run = promisify(execFile);
const MAX_BYTES = 1024 * 1024;
const MAX_PATCH_BYTES = 128 * 1024;
const hash = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
const safePath = (value: string) => value.length > 0 && !value.startsWith("/") && !value.split("/").some((part) => part === ".." || part === "." || part === "") && !/[\x00-\x1f\x7f\\]/u.test(value) && !isSensitiveRepositoryPath(value) && !value.startsWith(".understand-code/");

/** One complete bounded hunk; prefix/suffix trimming avoids quadratic work on large files. */
export function unifiedWorkbenchDiffV1(before: string, after: string, oldPath: string | null, newPath: string | null): string {
  const tokenize = (text: string) => text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
  const oldLines = tokenize(before), newLines = tokenize(after);
  let prefix = 0, suffix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++;
  const start = Math.max(0, prefix - 3);
  const oldEnd = Math.min(oldLines.length, oldLines.length - suffix + 3);
  const newEnd = Math.min(newLines.length, newLines.length - suffix + 3);
  let patch = `--- ${oldPath === null ? "/dev/null" : `a/${oldPath}`}\n+++ ${newPath === null ? "/dev/null" : `b/${newPath}`}\n`;
  if (before === after) return oldPath === newPath ? "" : oldPath === null || newPath === null ? patch : `rename from ${oldPath}\nrename to ${newPath}\n${patch}`;
  patch += `@@ -${oldEnd === start ? start : start + 1},${oldEnd - start} +${newEnd === start ? start : start + 1},${newEnd - start} @@\n`;
  const line = (prefix: string, value: string) => `${prefix}${value}${value.endsWith("\n") ? "" : "\n\\ No newline at end of file\n"}`;
  for (let i = start; i < prefix; i++) patch += line(" ", oldLines[i]!);
  for (let i = prefix; i < oldLines.length - suffix; i++) patch += line("-", oldLines[i]!);
  for (let i = prefix; i < newLines.length - suffix; i++) patch += line("+", newLines[i]!);
  for (let i = oldLines.length - suffix; i < oldEnd; i++) patch += line(" ", oldLines[i]!);
  return patch;
}

async function historicalSource(root: string, snapshot: RepositorySnapshotPersistedPayloadV1, filePath: string, digest?: string): Promise<Buffer | undefined> {
  if (digest !== undefined && !/^sha256:[0-9a-f]{64}$/u.test(digest)) return undefined;
  const indexed = await readRepositoryIndexSourceV1({ canonicalRoot: root, sourceSnapshotId: snapshot.snapshotId, filePath, ...(digest === undefined ? {} : { contentDigest: digest as `sha256:${string}` }) });
  if (indexed !== undefined) return indexed;
  const head = "headState" in snapshot ? snapshot.headState.kind === "commit" ? snapshot.headState.commit : undefined : snapshot.headCommit;
  if (!head || !/^[0-9a-f]{40,64}$/u.test(head)) return undefined;
  if (digest === undefined && "changes" in snapshot && snapshot.changes.some((change) => change.path === filePath || change.oldPath === filePath)) return undefined;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  try {
    const { stdout } = await run("git", ["--no-optional-locks", "-C", root, "cat-file", "blob", `${head}:${filePath}`], { env: { ...env, GIT_NO_REPLACE_OBJECTS: "1", GIT_TERMINAL_PROMPT: "0" }, encoding: "buffer", timeout: 10_000, maxBuffer: MAX_BYTES });
    return digest === undefined || hash(stdout) === digest ? stdout : undefined;
  } catch { return undefined; }
}

async function baselinePathIsAbsent(root: string, snapshot: RepositorySnapshotPersistedPayloadV1, filePath: string): Promise<boolean> {
  if ("changes" in snapshot && snapshot.changes.some((change) => change.path === filePath || change.oldPath === filePath)) return false;
  const head = "headState" in snapshot ? snapshot.headState.kind === "commit" ? snapshot.headState.commit : undefined : snapshot.headCommit;
  if (!head || !/^[0-9a-f]{40,64}$/u.test(head)) return false;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  const options = { env: { ...env, GIT_NO_REPLACE_OBJECTS: "1", GIT_TERMINAL_PROMPT: "0" }, encoding: "buffer" as const, timeout: 10_000, maxBuffer: MAX_BYTES };
  try {
    // ls-tree succeeds with empty output only when the exact readable tree has no such literal path.
    const { stdout } = await run("git", ["--no-optional-locks", "--literal-pathspecs", "-C", root, "ls-tree", "-z", "--full-tree", head, "--", filePath], options);
    return stdout.length === 0;
  } catch { return false; }
}

export async function projectWorkbenchDiffV1(input: {
  store: ArtifactStore; canonicalRoot: string; item: PersistedEvidenceV1;
  baselineSnapshotId: string; currentSnapshotId: string;
}): Promise<Pick<WorkbenchEvidenceReadyV1, "evidence" | "diff"> | undefined> {
  const { item, store, canonicalRoot } = input;
  if (!("filePath" in item) || !safePath(item.filePath)) return undefined;
  const parsed = item.kind === "diff_hunk" ? DiffHunkEvidenceV1Schema.safeParse(item) : undefined;
  if (parsed && !parsed.success) return undefined;
  const hunk = parsed?.success ? parsed.data.hunk : undefined;
  if (hunk && hunk.actualSnapshotId !== input.currentSnapshotId) return undefined;
  const [baselineRead, currentRead] = await Promise.all([
    store.readArtifact("repository_snapshot", { snapshotId: input.baselineSnapshotId }),
    store.readArtifact("repository_snapshot", { snapshotId: input.currentSnapshotId }),
  ]);
  if (baselineRead.artifact.artifactType !== "repository_snapshot" || currentRead.artifact.artifactType !== "repository_snapshot") return undefined;
  const baseline = baselineRead.artifact.payload, current = currentRead.artifact.payload;
  if (baseline.snapshotId !== input.baselineSnapshotId || current.snapshotId !== input.currentSnapshotId) return undefined;
  const change = "changes" in current ? current.changes.find((entry) => entry.path === item.filePath) : undefined;
  const oldPath = hunk?.oldPath ?? change?.oldPath ?? item.filePath;
  if (!safePath(oldPath)) return undefined;
  const beforeDigest = hunk?.beforeContent.status === "content" ? hunk.beforeContent.contentDigest : item.observedAtSnapshotId === baseline.snapshotId && "contentHash" in item ? item.contentHash : undefined;
  const afterDigest = hunk?.afterContent.status === "content" ? hunk.afterContent.contentDigest : item.observedAtSnapshotId === current.snapshotId && "contentHash" in item ? item.contentHash : change?.contentDigest;
  const deleted = hunk?.afterContent.status === "absent" || change?.kind === "deleted";
  if (!(item.epistemicStatus === "observed" || item.epistemicStatus === "inferred") ||
      !((item.freshness === "current" && item.observedAtSnapshotId === current.snapshotId) || (deleted && item.freshness === "changed" && item.observedAtSnapshotId === baseline.snapshotId))) return undefined;
  let beforeAbsent = hunk?.beforeContent.status === "absent";
  let before = beforeAbsent ? Buffer.alloc(0) : await historicalSource(canonicalRoot, baseline, oldPath, beforeDigest);
  if (before === undefined && change?.kind === "added" && await baselinePathIsAbsent(canonicalRoot, baseline, oldPath)) {
    before = Buffer.alloc(0);
    beforeAbsent = true;
  }
  if (before === undefined) return undefined;
  let after: Buffer;
  if (deleted) {
    // An immutable current Snapshot plus absence on disk prevents showing a deletion after a recreation.
    try { await readStableRepositoryFile(canonicalRoot, item.filePath, MAX_BYTES); return undefined; }
    catch (error) { if (!(error instanceof Error) || !("code" in error) || !["ENOENT", "not_found"].includes(String(error.code))) return undefined; }
    after = Buffer.alloc(0);
  } else {
    after = await readStableRepositoryFile(canonicalRoot, item.filePath, MAX_BYTES);
    if (afterDigest === undefined || hash(after) !== afterDigest) return undefined;
  }
  if (before.includes(0) || after.includes(0)) return undefined;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const oldText = decoder.decode(before), newText = decoder.decode(after);
  if (hunk) {
    for (const [span, text] of [[hunk.oldSpan, oldText], [hunk.newSpan, newText]] as const) {
      const end = span.startLine + span.lineCount - 1;
      if (!Number.isSafeInteger(end) || (span.lineCount > 0 && (span.startLine < 1 || end > text.split("\n").length))) return undefined;
    }
  }
  if (oldText.includes(canonicalRoot) || newText.includes(canonicalRoot)) return undefined;
  const oldName = beforeAbsent ? null : oldPath;
  const newName = deleted ? null : item.filePath;
  const unifiedDiff = unifiedWorkbenchDiffV1(oldText, newText, oldName, newName);
  if (unifiedDiff === "" || Buffer.byteLength(unifiedDiff) > MAX_PATCH_BYTES) return undefined;
  const baselineEvidence = item.observedAtSnapshotId === baseline.snapshotId;
  const span = hunk ? hunk.newSpan.lineCount > 0 ? hunk.newSpan : hunk.oldSpan : undefined;
  const lineRange: readonly [number, number] = "lineRange" in item && item.lineRange ? item.lineRange : span ? [Math.max(1, span.startLine), Math.max(1, span.startLine + span.lineCount - 1)] : [1, Math.max(1, (deleted ? oldText : newText).split("\n").length)];
  return {
    evidence: { id: item.id, kind: "source", epistemicStatus: item.epistemicStatus, freshness: baselineEvidence ? "changed" : "current", nodeIds: [...new Set(item.nodeIds)].sort().slice(0, 256), filePath: item.filePath, lineRange, contentHash: hash(baselineEvidence || deleted ? before : after), observedAtSnapshotId: item.observedAtSnapshotId },
    diff: { oldPath: oldName, newPath: newName, baselineSnapshotId: baseline.snapshotId, currentSnapshotId: current.snapshotId, unifiedDiff },
  };
}
