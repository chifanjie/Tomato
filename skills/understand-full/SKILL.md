---
name: understand-full
description: "Run the full Understand Code workflow: generate graph, launch dashboard, generate knowledge base, and link the dashboard to the generated knowledge base"
argument-hint: "[project-path] [--full] [--review] [--language <lang>] [--parallel 1|2] [--resume] [--deterministic-kb] [--include-extended-topics] [--no-dashboard]"
---

# /understand-full

面向用户的快速开始和参数选择见源码仓库根目录的 `README.zh-CN.md`；本文件保留完整流程的执行契约。若此技能已被单独安装，请从安装包或项目主页打开对应手册。

Run the complete Understand Code workflow for a repository:

1. analyze the codebase and write `.understand-code/knowledge-graph.json`;
2. launch the dashboard against that graph;
3. generate `.understand-code/knowledge-base/` from the graph;
4. verify that the dashboard can serve the generated knowledge-base files.

Use this when the user wants the whole experience automated instead of running `/understand`, `/understand-dashboard`, and `/understand-kb` separately.

## Instructions

### Resolve Inputs

1. Resolve `PROJECT_ROOT`.
   - If `$ARGUMENTS` contains a non-flag path, resolve it against the current working directory.
   - Otherwise use the current working directory.
   - Verify the path exists and is a directory before continuing.
2. Preserve supported pass-through flags:
   - Pass `--full`, `--review`, and `--language <lang>` to `/understand`.
   - Pass `--parallel 1|2`, `--resume`, `--include-extended-topics`, and `--max-source-mb <n>` to `/understand-kb`.
   - If `--deterministic-kb` is present, run the deterministic knowledge-base generator path described in Phase 3 instead of the phased `/understand-kb` writer workflow.
   - If `--no-dashboard` is present, skip Phase 2 and only report the commands needed to launch later.
3. If `--deterministic-kb` is present, resolve `PLUGIN_ROOT` now — Phase 3 runs a
   script from the plugin checkout and cannot rely on the current directory.

   ```bash
   # Locate the shared resolver, then let it validate and print the plugin root.
   # The resolution order and diagnostics live in scripts/resolve-plugin-root.sh.
   PLUGIN_ROOT=""
   for base in "${CLAUDE_PLUGIN_ROOT:-}" \
     "$HOME/.understand-code-plugin" \
     "$(realpath "$HOME/.agents/skills/understand-full/../.." 2>/dev/null)" \
     "$(realpath "$HOME/.copilot/skills/understand-full/../.." 2>/dev/null)" \
     "$HOME/.codex/understand-code/understand-code-plugin" \
     "$HOME/.opencode/understand-code/understand-code-plugin" \
     "$HOME/.pi/understand-code/understand-code-plugin" \
     "$HOME/understand-code/understand-code-plugin"; do
     if [ -n "$base" ] && [ -f "$base/scripts/resolve-plugin-root.sh" ]; then
       PLUGIN_ROOT=$(bash "$base/scripts/resolve-plugin-root.sh") || exit 1
       break
     fi
   done

   if [ -z "$PLUGIN_ROOT" ]; then
     echo "Error: Cannot find the understand-code plugin root." >&2
     echo "Set CLAUDE_PLUGIN_ROOT, or reinstall the plugin for your host." >&2
     exit 1
   fi
   ```

### Phase 1 - Generate graph

1. Invoke the existing `/understand` skill for `PROJECT_ROOT`.
2. Include any pass-through graph flags.
3. Wait until the graph command finishes.
4. Verify that the following file exists:

   ```text
   $PROJECT_ROOT/.understand-code/knowledge-graph.json
   ```

5. If graph generation fails or validation reports critical errors, stop before launching the dashboard or generating the knowledge base. Report the graph error and the graph path if a partial graph was saved.

### Phase 2 - Launch dashboard for the graph

1. Unless `--no-dashboard` was passed, invoke `/understand-dashboard PROJECT_ROOT`.
2. Capture the dashboard URL printed by Vite. It must include the access token:

   ```text
   http://127.0.0.1:<PORT>/?token=<TOKEN>
   ```

3. Keep this URL for the final report and for Phase 4 verification.
4. Do not omit the `?token=` parameter. Without it, the dashboard will show the access-token gate and cannot read graph or knowledge-base files.

The dashboard reads from `GRAPH_DIR=<PROJECT_ROOT>`. It can show the graph immediately, and the frontend will retry empty knowledge-base context while the knowledge base is being generated.

### Phase 3 - Generate knowledge base

1. If `--deterministic-kb` was passed, run the deterministic generator directly:

   ```bash
   node "$PLUGIN_ROOT/skills/understand-kb/generate-knowledge-base.mjs" "$PROJECT_ROOT" --deterministic-only
   ```

   Use this for fast local coverage when the user prefers speed over writer quality.

2. Otherwise invoke `/understand-kb PROJECT_ROOT` with the supported pass-through knowledge-base flags.
3. Wait until knowledge-base generation finishes.
4. Verify that the generated output directory exists:

   ```text
   $PROJECT_ROOT/.understand-code/knowledge-base/
   ```

5. Verify these expected linkage files when present:

   ```text
   $PROJECT_ROOT/.understand-code/knowledge-base/knowledge-base-profile.json
   $PROJECT_ROOT/.understand-code/knowledge-base/业务能力索引.md
   $PROJECT_ROOT/.understand-code/knowledge-base/业务流程地图.md
   $PROJECT_ROOT/.understand-code/knowledge-base/.trace/document-traces.json
   ```

Some knowledge-base modes may omit `.trace/document-traces.json`; treat that as a degraded-linkage warning, not a total failure, as long as Markdown indexes were generated.

### Phase 4 - Verify dashboard linkage

1. If the dashboard was skipped, report that graph and knowledge-base files were generated but dashboard linkage was not verified.
2. If the dashboard URL was captured, use the tokenized URL to verify protected endpoints:
   - `GET /knowledge-graph.json?token=<TOKEN>` should return `200`.
   - `GET /knowledge-base/knowledge-base-profile.json?token=<TOKEN>` should return `200` after Phase 3.
   - `GET /knowledge-base/%E4%B8%9A%E5%8A%A1%E8%83%BD%E5%8A%9B%E7%B4%A2%E5%BC%95.md?token=<TOKEN>` should return `200` if `业务能力索引.md` exists.
3. Report the final status:
   - graph path;
   - knowledge-base path;
   - dashboard URL including `?token=`;
   - any degraded-linkage warnings.

## Final Response Format

Keep the final response concise:

```text
全流程已完成。
图谱: <PROJECT_ROOT>/.understand-code/knowledge-graph.json
知识库: <PROJECT_ROOT>/.understand-code/knowledge-base/
Dashboard: http://127.0.0.1:<PORT>/?token=<TOKEN>
联动校验: graph 200, knowledge-base profile 200
```

If any phase fails, report the failed phase first and include the exact path or command the user can inspect.
