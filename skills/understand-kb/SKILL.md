---
name: understand-kb
description: Generate a complete Markdown knowledge base from an existing understand-code code knowledge graph
argument-hint: [project-path] [--parallel 1|2] [--resume] [--include-extended-topics] [--deterministic-only]
---

# /understand-kb

Generate `.understand-code/knowledge-base/` from `.understand-code/knowledge-graph.json`.

The command assumes `/understand` has already scanned the repository. It uses the graph as the fact source, writes one file document for every graph file node, covers every function/class card inside its parent file document, plans uncapped topic documents from graph and file-writer signals, and writes a strict coverage report.

## Instructions

1. Resolve `PROJECT_ROOT`.
   - If `$ARGUMENTS` contains a path, use that path.
   - Otherwise, use the current working directory.
   - Resolve relative paths against the current working directory.

2. Resolve `PARALLEL_LIMIT`.
   - If `$ARGUMENTS` contains `--parallel <n>`, only accept `1` or `2`.
   - Otherwise use `1`.
   - Prefer `1` by default for quality and memory headroom; use `2` only when the user explicitly asks to trade more memory for speed.
   - Do not raise this just to make generation faster.

2.25. Resolve queue control flags.
   - If `$ARGUMENTS` contains `--resume`, pass `--resume` to every lease phase in this run.
   - If `$ARGUMENTS` contains `--include-extended-topics`, keep the default required-topic pass first, then run a second topic pass for extended topics after the required-topic finalize succeeds.
   - Safety posture: keep the fixed pool at `1` or `2` workers. More concurrency is not the goal here; reliable lease ownership is.

2.5. Resolve memory safety flags.
   - If `$ARGUMENTS` contains `--max-source-mb <n>`, pass it to every `generate-knowledge-base.mjs` phase.
   - Otherwise use the script default.
   - Do not run deterministic-only generation for large graphs unless the user explicitly asks and passes `--allow-large-deterministic`.

2.75. Preserve quality without increasing fan-out.
   - Keep `$PARALLEL_LIMIT` at `1` or `2`.
   - Higher document quality should come from evidence packets, detailed writer prompts, and contract validation.
   - Do not create extra ad-hoc writer workers to make the run appear faster.
   - If a writer batch fails quality validation, retry the leased batch with the concrete validation reason.

3. Check that `$PROJECT_ROOT/.understand-code/knowledge-graph.json` exists.
   - If it does not exist, tell the user:
     ```text
     No knowledge graph found. Run /understand first, then run /understand-kb.
     ```
   - Stop.

4. Resolve `PLUGIN_ROOT`.

   Do not assume the plugin root is simply two directories above the skill path string. In many installations skills are symlinked. Prefer runtime roots first, then fall back to universal symlinks, skill symlink resolution, and common clone-based install paths.

   ```bash
   SKILL_REAL=$(realpath ~/.agents/skills/understand-kb 2>/dev/null || readlink -f ~/.agents/skills/understand-kb 2>/dev/null || echo "")
   SELF_RELATIVE=$([ -n "$SKILL_REAL" ] && cd "$SKILL_REAL/../.." 2>/dev/null && pwd || echo "")
   COPILOT_SKILL_REAL=$(realpath ~/.copilot/skills/understand-kb 2>/dev/null || readlink -f ~/.copilot/skills/understand-kb 2>/dev/null || echo "")
   COPILOT_SELF_RELATIVE=$([ -n "$COPILOT_SKILL_REAL" ] && cd "$COPILOT_SKILL_REAL/../.." 2>/dev/null && pwd || echo "")

   PLUGIN_ROOT=""
   for candidate in \
     "${CLAUDE_PLUGIN_ROOT}" \
     "$HOME/.understand-code-plugin" \
     "$SELF_RELATIVE" \
     "$COPILOT_SELF_RELATIVE" \
     "$HOME/.codex/understand-code/understand-code-plugin" \
     "$HOME/.opencode/understand-code/understand-code-plugin" \
     "$HOME/.pi/understand-code/understand-code-plugin" \
     "$HOME/understand-code/understand-code-plugin"; do
     if [ -n "$candidate" ] && [ -f "$candidate/package.json" ] && [ -f "$candidate/pnpm-workspace.yaml" ]; then
       PLUGIN_ROOT="$candidate"
       break
     fi
   done

   if [ -z "$PLUGIN_ROOT" ]; then
     echo "Error: Cannot find the understand-code plugin root."
     exit 1
   fi
   ```

5. Build core if needed.

   ```bash
   cd "$PLUGIN_ROOT"
   if [ ! -f "$PLUGIN_ROOT/packages/core/dist/index.js" ]; then
     pnpm --filter @understand-code/core build
   fi
   ```

6. If the user passed `--deterministic-only`, run the local deterministic generator and stop after reporting its output.

   ```bash
   node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --deterministic-only
   ```

   For large graphs, the script refuses deterministic-only mode unless `--allow-large-deterministic` is present. Use the phased path below instead.

7. Prepare file document batches.

   ```bash
   node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --prepare-file-docs
   ```

8. Create exactly `$PARALLEL_LIMIT` logical file workers.
   - Default worker count is `2`.
   - Maximum worker count is `2`.
   - Use stable worker ids such as `file-writer-1` and `file-writer-2`.

9. Run the file-worker lease loop until every worker receives `null`.
   - Each file worker repeatedly runs:
     ```bash
     node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --lease-file-batch --worker-id <id> [--resume]
     ```
   - If the lease output is `null`, that worker stops.
   - Otherwise the worker runs `agents/kb-file-writer.md` for the leased batch only.
   - Each worker receives the leased `FileDocBatch`, the associated `FileDocTask` objects, graph context, source snapshots, `workerId`, `attemptNumber`, `previousFailureReason` when present, and `leasedBatchIndex`.
   - Each worker must write exactly one JSON file:
     ```text
     $PROJECT_ROOT/.understand-code/knowledge-base/.intermediate/file-doc-batch-<batchIndex>.json
     ```
   - After the writer returns, verify that the expected JSON file exists.
   - On success, complete the lease:
     ```bash
     node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --complete-file-batch --worker-id <id> --batch-index <n> --result-status succeeded
     ```
   - On validation failure, missing output, or other batch-specific failure, complete the lease with a non-success `--result-status` that preserves the concrete reason.

10. After all file workers stop, merge file writer outputs.

    ```bash
    node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --merge-file-docs
    ```

11. Prepare the required-topic queue.

    ```bash
    node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --prepare-topics
    ```

12. Create exactly `$PARALLEL_LIMIT` logical topic workers.
    - Default worker count is `2`.
    - Maximum worker count is `2`.
    - Use stable worker ids such as `topic-writer-1` and `topic-writer-2`.

13. Run the topic-worker lease loop until every worker receives `null`.
    - Each topic worker repeatedly runs:
      ```bash
      node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --lease-topic-batch --worker-id <id> [--resume]
      ```
    - If the lease output is `null`, that worker stops.
    - Otherwise the worker runs `agents/kb-topic-writer.md` for the leased batch only.
    - Each worker receives the leased `TopicBatch`, graph context, the linked file document, source evidence, `workerId`, `attemptNumber`, `previousFailureReason` when present, `leasedBatchIndex`, `topicTier`, and `linkedFileDocumentSummary`.
    - Each worker must write exactly one JSON file:
      ```text
      $PROJECT_ROOT/.understand-code/knowledge-base/.intermediate/topic-batch-<batchIndex>.json
      ```
    - After the writer returns, verify that the expected JSON file exists.
    - On success, complete the lease:
      ```bash
      node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --complete-topic-batch --worker-id <id> --batch-index <n> --result-status succeeded
      ```
    - On validation failure, missing output, or other batch-specific failure, complete the lease with a non-success `--result-status` that preserves the concrete reason.

14. After all topic workers stop, finalize the knowledge base.

    ```bash
    node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --finalize
    ```

15. If the user passed `--include-extended-topics`, repeat the topic phase for extended topics after the required-topic finalize succeeds.
    - Re-run topic preparation with:
      ```bash
      node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --prepare-topics --include-extended-topics
      ```
    - Recreate exactly `$PARALLEL_LIMIT` logical topic workers.
    - Repeat the same `--lease-topic-batch` / topic writer / `--complete-topic-batch` loop for the new extended-topic queue.
    - Run `--finalize` again after the extended-topic workers stop.

16. Report the result to the user.
    - Knowledge base path: `$PROJECT_ROOT/.understand-code/knowledge-base/`
    - Generated Markdown document count from script output.
    - Coverage status from script output.
    - File document coverage from script output.
    - Function card coverage from script output.
    - Class card coverage from script output.
    - Business fact coverage from script output.
    - Business capability document coverage from script output.
    - Quality validation pass count from script output.

## Output

The generated directory includes:

```text
.understand-code/knowledge-base/
├── 目录.md
├── 项目总览.md
├── 架构地图.md
├── 业务流程地图.md
├── 待确认项.md
├── 覆盖报告.md
├── 业务能力索引.md
├── knowledge-base-profile.json
├── 索引/
├── 模块总览/
├── 业务流程/
├── 业务能力/
├── 文件文档/
├── 关键函数专题/
└── .intermediate/
```

The document count is not fixed. It is produced from graph coverage obligations, file document tasks, and uncapped topic planning.
