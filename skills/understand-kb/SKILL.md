---
name: understand-kb
description: Generate a complete Markdown knowledge base from an existing understand-anything code knowledge graph
argument-hint: [project-path] [--parallel N] [--deterministic-only]
---

# /understand-kb

Generate `.understand-anything/knowledge-base/` from `.understand-anything/knowledge-graph.json`.

The command assumes `/understand` has already scanned the repository. It uses the graph as the fact source, writes one file document for every graph file node, covers every function/class card inside its parent file document, plans uncapped topic documents from graph and file-writer signals, and writes a strict coverage report.

## Instructions

1. Resolve `PROJECT_ROOT`.
   - If `$ARGUMENTS` contains a path, use that path.
   - Otherwise, use the current working directory.
   - Resolve relative paths against the current working directory.

2. Resolve `PARALLEL_LIMIT`.
   - If `$ARGUMENTS` contains `--parallel <n>`, use that positive integer.
   - Otherwise use `2`.
   - For large business repositories, prefer `1` or `2`; do not raise this just to make generation faster.

2.5. Resolve memory safety flags.
   - If `$ARGUMENTS` contains `--max-source-mb <n>`, pass it to every `generate-knowledge-base.mjs` phase.
   - Otherwise use the script default.
   - Do not run deterministic-only generation for large graphs unless the user explicitly asks and passes `--allow-large-deterministic`.

3. Check that `$PROJECT_ROOT/.understand-anything/knowledge-graph.json` exists.
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
     "$HOME/.understand-anything-plugin" \
     "$SELF_RELATIVE" \
     "$COPILOT_SELF_RELATIVE" \
     "$HOME/.codex/understand-anything/understand-anything-plugin" \
     "$HOME/.opencode/understand-anything/understand-anything-plugin" \
     "$HOME/.pi/understand-anything/understand-anything-plugin" \
     "$HOME/understand-anything/understand-anything-plugin"; do
     if [ -n "$candidate" ] && [ -f "$candidate/package.json" ] && [ -f "$candidate/pnpm-workspace.yaml" ]; then
       PLUGIN_ROOT="$candidate"
       break
     fi
   done

   if [ -z "$PLUGIN_ROOT" ]; then
     echo "Error: Cannot find the understand-anything plugin root."
     exit 1
   fi
   ```

5. Build core if needed.

   ```bash
   cd "$PLUGIN_ROOT"
   if [ ! -f "$PLUGIN_ROOT/packages/core/dist/index.js" ]; then
     pnpm --filter @understand-anything/core build
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

8. Read `$PROJECT_ROOT/.understand-anything/knowledge-base/.intermediate/file-doc-batches.json`.

9. Dispatch `agents/kb-file-writer.md` for every file batch, with at most `$PARALLEL_LIMIT` concurrent agents.
   - Each agent receives one `FileDocBatch`, the associated `FileDocTask` objects, graph context, and source snapshots.
   - Each agent must write exactly one JSON file:
     ```text
     $PROJECT_ROOT/.understand-anything/knowledge-base/.intermediate/file-doc-batch-<batchIndex>.json
     ```
   - After each agent returns, verify that its expected JSON file exists.

10. Merge file writer outputs.

    ```bash
    node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --merge-file-docs
    ```

11. If `.intermediate/file-doc-retry-plan.json` exists and contains file batches, rerun only those batches once, then run `--merge-file-docs` again.

12. Prepare topic batches.

    ```bash
    node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --prepare-topics
    ```

13. Read `$PROJECT_ROOT/.understand-anything/knowledge-base/.intermediate/topic-batches.json`.

14. Dispatch `agents/kb-topic-writer.md` for every topic batch, with at most `$PARALLEL_LIMIT` concurrent agents.
    - Each agent receives one `TopicBatch`, graph context, the linked file document, and source evidence.
    - Each agent must write exactly one JSON file:
      ```text
      $PROJECT_ROOT/.understand-anything/knowledge-base/.intermediate/topic-batch-<batchIndex>.json
      ```
    - After each agent returns, verify that its expected JSON file exists.

15. Finalize the knowledge base.

    ```bash
    node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --finalize
    ```

16. Report the result to the user.
    - Knowledge base path: `$PROJECT_ROOT/.understand-anything/knowledge-base/`
    - Generated Markdown document count from script output.
    - Coverage status from script output.
    - File document coverage from script output.
    - Function card coverage from script output.
    - Class card coverage from script output.
    - Business fact coverage from script output.
    - Business capability document coverage from script output.

## Output

The generated directory includes:

```text
.understand-anything/knowledge-base/
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
