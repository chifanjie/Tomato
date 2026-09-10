import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import type { ArtifactStore } from "@understand-code/artifact-store";
import type { EvidenceV1 } from "@understand-code/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupTemporaryDirectories, createGitRepository } from "./helpers.js";

vi.mock("../src/runtime/repository-indexer.js", () => ({ readRepositoryIndexSourceV1: vi.fn(async () => undefined) }));
import { projectWorkbenchDiffV1, unifiedWorkbenchDiffV1 } from "../src/handlers/workbench-diff.js";
const digest = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
afterEach(cleanupTemporaryDirectories);

async function repositoryDiff(deleted: boolean, renamed = false, baselineText?: string) {
  const root = await createGitRepository({ seedArtifacts: false });
  const before = baselineText ?? "export const limit = 3;\nexport const name = 'old';\n";
  const after = "export const limit = 5;\nexport const name = 'new';\n";
  await writeFile(`${root}/src/task.ts`, before);
  execFileSync("git", ["add", "src/task.ts"], { cwd: root });
  execFileSync("git", ["commit", "-m", "baseline"], { cwd: root, stdio: "ignore" });
  const headCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const filePath = renamed ? "src/renamed.ts" : "src/task.ts";
  if (deleted || renamed) await rm(`${root}/src/task.ts`);
  if (!deleted) await writeFile(`${root}/${filePath}`, after);
  const snapshots = {
    "snapshot:before": { snapshotId: "snapshot:before", headCommit, changes: [] },
    "snapshot:after": { snapshotId: "snapshot:after", headCommit, changes: [{ path: filePath, ...(renamed ? { oldPath: "src/task.ts" } : {}), kind: deleted ? "deleted" : renamed ? "renamed" : "modified", contentDigest: deleted ? undefined : digest(after) }] },
  };
  const store = { async readArtifact(_type: string, { snapshotId }: { snapshotId: keyof typeof snapshots }) { return { artifact: { artifactType: "repository_snapshot", payload: snapshots[snapshotId] } }; } } as unknown as ArtifactStore;
  const item = { id: "evidence:change", kind: "source", epistemicStatus: "observed", freshness: deleted ? "changed" : "current", nodeIds: [], claimIds: [], filePath, lineRange: [1, 2], contentHash: digest(deleted ? before : after), observedAtSnapshotId: deleted ? "snapshot:before" : "snapshot:after", producedBy: "task-engine", createdAt: "2026-09-10T00:00:00Z" } as EvidenceV1;
  return { input: { store, canonicalRoot: root, item, baselineSnapshotId: "snapshot:before", currentSnapshotId: "snapshot:after" }, before, after, root };
}

describe("Workbench full snapshot diff", () => {
  it("reads the actual baseline Git blob and verifies the current source digest", async () => {
    const { input, root } = await repositoryDiff(false);
    const projected = await projectWorkbenchDiffV1(input);
    expect(projected?.diff?.unifiedDiff).toContain("-export const limit = 3;");
    expect(projected?.diff?.unifiedDiff).toContain("+export const limit = 5;");
    await writeFile(`${root}/src/task.ts`, "changed after snapshot\n");
    expect(await projectWorkbenchDiffV1(input)).toBeUndefined();
  });
  it("displays deletion from verified baseline bytes and rejects a recreated file", async () => {
    const { input, root } = await repositoryDiff(true);
    const projected = await projectWorkbenchDiffV1(input);
    expect(projected?.diff).toMatchObject({ oldPath: "src/task.ts", newPath: null, baselineSnapshotId: "snapshot:before", currentSnapshotId: "snapshot:after" });
    expect(projected?.diff?.unifiedDiff).toContain("+++ /dev/null");
    expect(projected?.diff?.unifiedDiff).toContain("-export const limit = 3;");
    expect(projected?.evidence).toMatchObject({ freshness: "changed", observedAtSnapshotId: "snapshot:before" });
    await writeFile(`${root}/src/task.ts`, "recreated\n");
    expect(await projectWorkbenchDiffV1(input)).toBeUndefined();
  });
  it("uses the old path when a file is renamed", async () => {
    const { input } = await repositoryDiff(false, true);
    expect((await projectWorkbenchDiffV1(input))?.diff).toMatchObject({ oldPath: "src/task.ts", newPath: "src/renamed.ts" });
  });
  it("rejects a baseline content hash mismatch and sensitive paths", async () => {
    const { input } = await repositoryDiff(true);
    expect(await projectWorkbenchDiffV1({ ...input, item: { ...input.item, contentHash: digest("wrong") } as EvidenceV1 })).toBeUndefined();
    expect(await projectWorkbenchDiffV1({ ...input, item: { ...input.item, filePath: ".env" } as EvidenceV1 })).toBeUndefined();
  });
  it("never turns an unreadable baseline into an added file", async () => {
    const { input } = await repositoryDiff(false);
    const read = input.store.readArtifact.bind(input.store);
    input.store.readArtifact = (async (...args: Parameters<typeof read>) => {
      const result = await read(...args);
      const payload = result.artifact.payload as any;
      if (payload.snapshotId === "snapshot:before") payload.headCommit = "0".repeat(40);
      else payload.changes[0].kind = "added";
      return result;
    }) as typeof read;
    expect(await projectWorkbenchDiffV1(input)).toBeUndefined();
  });
  it("preserves an existing empty baseline file even when current Git status says added", async () => {
    const { input } = await repositoryDiff(false, false, "");
    const current = await input.store.readArtifact("repository_snapshot", { snapshotId: "snapshot:after" });
    (current.artifact.payload as any).changes[0].kind = "added";
    expect((await projectWorkbenchDiffV1(input))?.diff?.oldPath).toBe("src/task.ts");
  });
  it("represents empty-file presence changes without invented rename metadata", () => {
    expect(unifiedWorkbenchDiffV1("", "", null, "empty.ts")).toBe("--- /dev/null\n+++ b/empty.ts\n");
    expect(unifiedWorkbenchDiffV1("", "", "empty.ts", null)).toBe("--- a/empty.ts\n+++ /dev/null\n");
  });
  it("retains missing-newline and zero-line addition/deletion semantics", () => {
    expect(unifiedWorkbenchDiffV1("", "added", null, "src/a.ts")).toContain("@@ -0,0 +1,1 @@\n+added\n\\ No newline at end of file");
    expect(unifiedWorkbenchDiffV1("deleted\n", "", "src/a.ts", null)).toContain("@@ -1,1 +0,0 @@\n-deleted\n");
  });
});
