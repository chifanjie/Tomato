const RECOVERY = {
  legacy_state_requires_recovery: "Old or unreadable repository artifacts were preserved. Close this repository's Hosts and readers, then run understand-code recover --root <absolute-worktree-root> --rebuild. It archives all old material and prints a restore command before rebuilding.",
  recovery_busy: "Recovery requires an offline repository. Stop MCP Hosts and Workbench readers; use index --status and index --cancel for an active index job, wait for writes to finish, then retry. Existing material was preserved.",
  recovery_unsafe_path: "Recovery refused an unsafe path or a backup from another worktree. Use the original Git worktree and an unchanged recovery backup; do not replace managed directories with symlinks.",
  recovery_no_state: "No existing .understand-code directory was found. Create a Task through the Host to initialize this repository; recovery is only needed for existing material.",
  recovery_rebuild_failed: "The original material remains in the printed backup directory. Correct the index failure and rerun recover --rebuild, or use the printed recover --restore command. Any partially rebuilt state is kept until you choose the next action.",
  knowledge_root_unavailable: "Use the absolute Git worktree root with --root; run git rev-parse --show-toplevel in the intended repository.",
  knowledge_local_task_required: "Use a persisted Task created by the local runtime in this repository; check its task ID before preparing knowledge.",
  writer_snapshot_stale: "Ask the host to refresh_index and refresh_task_context or rebase_task for this Task, then run knowledge with the same --root and --task-id plus --restart-draft. The old draft will be archived before fresh preparation.",
  writer_draft_exists: "The existing draft was preserved. Resume with --lease-file-batch, --merge-file-docs or --retry; to start over explicitly, use --restart-draft with the same --root and --task-id. It archives the complete old draft first.",
  writer_topics_exist: "Existing topic work was preserved. Resume with --lease-topic-batch, --complete-topic-batch or --finalize; use --retry to inspect failed batches.",
  writer_phase_failed: "Run the same knowledge command with --retry to inspect failures and --guide for the workflow. If the source binding changed, refresh/rebase this Task, then use --restart-draft to archive the old work and prepare again. Otherwise correct the reported validation failure before retrying the phase.",
} as const;

/** Only these fixed messages may cross the CLI error boundary unredacted. */
export class CliOperationErrorV1 extends Error {
  readonly code: keyof typeof RECOVERY;
  constructor(code: keyof typeof RECOVERY) {
    super(RECOVERY[code]);
    this.name = "CliOperationErrorV1";
    this.code = code;
  }
}
