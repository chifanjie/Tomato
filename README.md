# Understand Code

Understand Code turns a repository into a traceable knowledge graph, architecture view, business-domain analysis artifacts, a Markdown knowledge base, and code-aware question/answer workflows.

使用说明请先阅读 [中文使用手册](README.zh-CN.md)。它包含技能版与 Codex Alpha MCP 版的入口区别、两分钟快速开始、Dashboard token、输出目录、场景教程、持续更新和排错步骤。

## Install into Claude Code

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
