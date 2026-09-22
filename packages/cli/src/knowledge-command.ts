import { readFile, lstat } from "node:fs/promises";
import path from "node:path";
import { ArtifactStore } from "@understand-code/artifact-store";
import * as core from "@understand-code/core";
import { runKnowledgeBaseGenerator } from "../../../skills/understand-kb/generate-knowledge-base.mjs";
import type { CliInvocation } from "./argv.js";
import { resolveInitialBinding } from "./binding/root-binding.js";
import { CliOperationErrorV1 } from "./errors/cli-operation-error.js";
import { hasRepositoryAccess, withRepositoryAccess } from "./runtime/recovery-guard.js";
import { archiveWriterDraft, withRecoverySession } from "./recovery-command.js";
import { PRODUCT_VERSION } from "./constants.js";
import { captureLocalRepositorySnapshot } from "./runtime/context.js";
import { openActiveRepositoryIndexV1, discardPendingRepositoryIndexV1, readPendingRepositoryIndexV1, cleanupInterruptedPendingRepositoryIndexesV1 } from "./runtime/repository-indexer.js";

declare const __UNDERSTAND_CODE_WRITER_GUIDES__: { files: string; topics: string; featured: string } | undefined;

export const KNOWLEDGE_WORKFLOW = `Task knowledge writer workflow (no separate skill installation required):
Use the same --root and --task-id on every command. Drafts stay under .understand-code/knowledge-drafts/<taskId>.
1. --prepare-file-docs prepares source-bound file tasks. Existing work is preserved: resume with lease/merge commands.
2. --lease-file-batch --worker-id writer-1; the Host reads the leased source and writes .intermediate/file-doc-batch-<batchIndex>.json using the file writer guide below.
3. --complete-file-batch --worker-id writer-1 --batch-index <n> --result-status succeeded; repeat until lease returns null.
4. --merge-file-docs, then --prepare-topics.
5. --lease-topic-batch / --complete-topic-batch with the same worker/batch flags; write .intermediate/topic-batch-<batchIndex>.json using the topic guide.
6. --prepare-topics also writes .intermediate/featured-plan.json. Following the featured writer guide, the Host writes every planned overview/reading/flow/module page into .intermediate/featured-writer-output.json. --prepare-featured can regenerate only this plan without overwriting writer work.
7. --finalize validates and assembles all three writer layers. --retry shows concrete validation failures.
8. In the Host call refresh_index with mode=full, the current expectedSourceSnapshotId, and knowledge={action:stage,taskId,expectedTaskRevision}.
9. Review the candidate in Workbench. After actual checks and verification, explicitly publish that candidate using knowledge.action=publish and candidateGenerationId.
This command prepares and validates writer work. It does not invent business explanations, perform tests, or mark diagnostics as publishable.
To explicitly start over after refreshing/rebasing this Task: --restart-draft archives the whole old draft, prints its restore command, and prepares a fresh source-bound draft. Stop other writers first.
To discard one unneeded candidate: --discard-candidate --candidate <generationId>.
To remove interrupted temporary writes while preserving complete candidates: --cleanup-interrupted.
`;

export async function runKnowledgeCommand(invocation: Extract<CliInvocation, { kind: "knowledge" }>): Promise<void> {
  const binding = await resolveInitialBinding([invocation.root]);
  if (binding.kind !== "bound") throw new CliOperationErrorV1("knowledge_root_unavailable");
  const canonicalRoot = binding.canonicalRoot;
  if (invocation.writerArgs.includes("--guide")) {
    const guides = typeof __UNDERSTAND_CODE_WRITER_GUIDES__ !== "undefined" ? __UNDERSTAND_CODE_WRITER_GUIDES__ : {
      files: await readFile(new URL("../../../agents/kb-file-writer.md", import.meta.url), "utf8"),
      topics: await readFile(new URL("../../../agents/kb-topic-writer.md", import.meta.url), "utf8"),
      featured: await readFile(new URL("../../../agents/kb-featured-writer.md", import.meta.url), "utf8"),
    };
    process.stdout.write(`${KNOWLEDGE_WORKFLOW}\n${guides.files}\n${guides.topics}\n${guides.featured}\n`);
    return;
  }
  if (!invocation.writerArgs.includes("--restart-draft") && !hasRepositoryAccess(canonicalRoot)) {
    return withRepositoryAccess(canonicalRoot, () => runKnowledgeCommand(invocation));
  }
  const capture = await captureLocalRepositorySnapshot(canonicalRoot);
  const store = await ArtifactStore.open(canonicalRoot, { repositoryId: capture.snapshot.repositoryId, worktreeId: capture.snapshot.worktreeId, producerVersion: PRODUCT_VERSION });
  const task = (await store.readTaskBundle(invocation.taskId)).bundle.manifest;
  const active = await openActiveRepositoryIndexV1(canonicalRoot);
  if (active.authority.runtimeProfile !== "local_durable_v1" || task.taskProfile !== undefined) throw new CliOperationErrorV1("knowledge_local_task_required");
  if (invocation.writerArgs.includes("--cleanup-interrupted")) {
    const result = await cleanupInterruptedPendingRepositoryIndexesV1({ canonicalRoot });
    process.stdout.write(`${JSON.stringify({ status: "cleaned", ...result })}\n`);
    return;
  }
  if (invocation.writerArgs.includes("--discard-candidate")) {
    const candidate = await readPendingRepositoryIndexV1({ canonicalRoot, generationId: invocation.candidateGenerationId! });
    await discardPendingRepositoryIndexV1({ canonicalRoot, taskId: task.taskId, generationId: invocation.candidateGenerationId!, expectedSourceSnapshotId: candidate.knowledgeLineage.sourceSnapshotId });
    process.stdout.write(`${JSON.stringify({ status: "discarded", taskId: task.taskId, candidateGenerationId: invocation.candidateGenerationId })}\n`);
    return;
  }
  if (!invocation.writerArgs.includes("--retry") && (task.latestSnapshotId !== capture.snapshot.snapshotId || active.authority.sourceSnapshotId !== task.latestSnapshotId)) {
    throw new CliOperationErrorV1("writer_snapshot_stale");
  }
  const outputRoot = path.join(canonicalRoot, ".understand-code/knowledge-drafts", task.taskId);
  if (invocation.writerArgs.includes("--restart-draft")) {
    await withRecoverySession(canonicalRoot, async (backupRoot) => {
      await archiveWriterDraft(canonicalRoot, task.taskId, backupRoot);
      await runKnowledgeCommand({ ...invocation, writerArgs: invocation.writerArgs.map((argument) => argument === "--restart-draft" ? "--prepare-file-docs" : argument) });
    });
    return;
  }
  if (invocation.writerArgs.includes("--prepare-file-docs")) {
    const existing = await lstat(path.join(outputRoot, ".intermediate")).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; return undefined; });
    if (existing) throw new CliOperationErrorV1("writer_draft_exists");
  }
  if (invocation.writerArgs.includes("--prepare-topics")) {
    const existing = await lstat(path.join(outputRoot, ".intermediate", "topic-queue.json")).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; return undefined; });
    if (existing) throw new CliOperationErrorV1("writer_topics_exist");
  }
  // Use the immutable, digest-checked graph. The writer validates current source
  // binding again at merge/finalize; a changed source can never silently publish.
  await active.read("knowledge-graph.json");
  try {
    await runKnowledgeBaseGenerator([process.execPath, "understand-code-knowledge", canonicalRoot,
    "--source-root", canonicalRoot, "--output-root", outputRoot,
    "--graph-path", path.join(active.generationRoot, "knowledge-graph.json"), ...invocation.writerArgs], core);
  } catch {
    throw new CliOperationErrorV1("writer_phase_failed");
  }
}
