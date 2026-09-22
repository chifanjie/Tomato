# Understand Code

Understand Code turns a repository into a traceable knowledge graph, architecture view, business-domain analysis artifacts, a Markdown knowledge base, and code-aware question/answer workflows.

使用说明请先阅读 [中文使用手册](README.zh-CN.md)。它包含技能版与 Codex Alpha MCP 版的入口区别、两分钟快速开始、Dashboard token、输出目录、场景教程、持续更新和排错步骤。

## Codex / Claude MCP Task workflow

The `0.1.0-preview.2` package adds `local_durable_v1` for macOS and Linux.
After installing a locally built Preview tarball, register one Host with
`understand-code-preview --install-host codex` or
`understand-code-preview --install-host claude`. The helper uses the Host's
official plugin commands and runs Doctor; the selected Host CLI must already be
installed. See the [build, install and lifecycle guide](packages/preview/README.md).
Open a new session in your target Git repository and ask:

> Use Understand Code to explain this feature. Read the repository state,
> create a persistent Task with goals and acceptance criteria, attach source
> evidence and unknowns, and return its taskId and Workbench link.

The Host uses MCP tools to initialize missing repository artifacts, create and
read the Task, search context, persist analysis, check actual changes, and
record verification that the Host really performed. The Workbench shows task
history, readable claims and evidence, source/diffs, revision refresh, Graph,
and Wiki. It does not execute tests or replace the Host conversation.

Workbench links now allow 24 hours for their first opening; authenticated
browser sessions have a 24-hour absolute lifetime and a 24-hour idle timeout.
Keep the process that opened the Workbench running. If the page asks you to
reopen the link from the Host, call `open_workbench` again for a fresh single-use
link. After updating, rebuild or install the updated runtime and restart the
MCP server before requesting that link; existing expired links are not renewed.

To read persisted Tasks after the Host exits, run
`understand-code workbench --root /absolute/path/to/worktree --no-open` and open
the newly printed link. Add `--task-id "<TASK_ULID>"` to select a Task. Keep this
reader CLI running; stop it with Ctrl+C.

For a formal knowledge draft, give the Host
`understand-code knowledge --root /absolute/path/to/worktree --task-id "<TASK_ULID>" --guide`.
The installed CLI includes file, topic, and featured-page writer guides and
draft preparation/validation commands. After `--prepare-topics`, the Host writes
every page in `.intermediate/featured-plan.json` to
`.intermediate/featured-writer-output.json` with its exact identity and source
evidence; `--finalize` requires this authored content. The Host reads source,
writes explanations, and performs real
verification; MCP `refresh_index` stages and explicitly publishes the reviewed
candidate. See [the writer lifecycle and recovery commands](packages/cli/README.md#task-knowledge-lifecycle).

The package contains MCP tools, not the `/understand-*` skills below. Source
skills `2.7.6` and Preview `0.1.0-preview.2` have independent version numbers.
The earlier `0.1.0-preview.1` macOS task path remains locked; a healthy plugin
registration on that version does not establish task capability.

Check four separate states: plugin registered, tools available in the current
Host session, repository artifacts valid, and task runtime ready. A declared
tool or passing Demo is not evidence of a successful real task. Follow the
[versioned experience test plan](docs/testing/understand-code-codex-experience-test-plan.md)
and [remediation evidence record](docs/testing/2026-09-10-audit-remediation.md)
for actual acceptance status. Desktop, CLI, IDE and cross-Host continuity need
separate real-session verification. Static graph relations and deterministic
Wiki drafts do not establish complete business understanding or publishable
knowledge. A first local `build_task_brief` starts a durable background index and
returns a job ID promptly. The Host polls or cancels with `index_job`, then replays
the original build request after completion. Jobs survive Host exit; existing-index
Task creation remains synchronous. Explicit `refresh_index` calls support stage
progress and cooperative request cancellation. [Language and relation limits](packages/cli/README.md#language-and-relation-boundaries)
describe which imports and calls can be resolved without guessing.

## Source skills: install into Claude Code

This repository is itself an installable Claude Code plugin marketplace:

```
/plugin marketplace add Lum1104/Understand-Code
```

```
/plugin install understand-code@understand-code
```

For local development, point the first command at your checkout instead
(`/plugin marketplace add /absolute/path/to/understand-code`). Claude Code
auto-discovers `skills/`, `agents/`, and `hooks/hooks.json`. Validate a checkout
before installing with `claude plugin validate /absolute/path/to/understand-code`.

Then, in a repository you want to analyze:

- `/understand` — scan the repo into `.understand-code/knowledge-graph.json`
- `/understand-kb` — generate the linked Markdown knowledge base
- `/understand-dashboard` — open the graph and wiki in the browser
- `/understand-full` — run all three in one pass
- `/understand-doctor` — diagnose the install and report what to run next

The repository also contains the runtime-oriented references for the [CLI](packages/cli/README.md), [Preview package](packages/preview/README.md), and individual [skills](skills/).
