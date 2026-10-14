# Tomato / Understand Code 中文使用手册

Understand Code 把一个代码仓库整理成可追溯的知识图谱、架构视图、业务流程分析产物、Markdown 知识库和面向代码的问答入口。它适合第一次接手陌生项目、评估一组代码改动、梳理业务链路，或把一次性的代码分析变成可以持续更新的项目资料。

这份手册解决的是“安装后下一步怎么做”。内部实现规范仍以各技能文件为准：[`skills/understand/SKILL.md`](skills/understand/SKILL.md)、[`skills/understand-full/SKILL.md`](skills/understand-full/SKILL.md) 等。文档结构参考了 [ECC 中文手册](https://github.com/affaan-m/ECC/blob/main/README.zh-CN.md) 的读者路径、快速开始、能力地图、场景配方和排错章节，但命令和行为全部以本项目实际实现为准。

> **先区分入口和版本：** `0.1.0-preview.2` 的 Codex/Claude MCP 安装包新增 macOS/Linux 本地持久任务运行时 `local_durable_v1`，用于自然语言需求 → Task → 证据工作台。旧版 `0.1.0-preview.1` 在 macOS 的任务路径仍受锁定限制，注册 healthy 不能证明它可创建任务。安装包仅含 MCP server，不含 `/understand-full`、`$understand-full` 等源码技能；安装 MCP 后直接在宿主描述需求，按下方“Codex MCP 快速开始”操作。本文 `/understand-*` 命令属于另行安装的源码技能路线。

> 当前仓库的技能版本来自 `.claude-plugin/plugin.json`（2.7.6）。可安装 Preview CLI 的版本是独立的 `@understand-code/preview` 包；两者不是同一个入口，见[安装与版本路线](#安装与版本路线)。

## Codex MCP 快速开始

安装 [Preview MCP 插件](#preview-cli可选) 后，在目标 Git 仓库打开一个新 Codex 会话并发送：

```text
请使用 Understand Code 分析这个需求：<填写需求或业务问题>。
先确认当前仓库和快照；如果尚未初始化，请通过工具完成初始化。
创建持久任务，写入目标、验收条件、源码证据和未知项。
请返回真实 taskId、当前修订版和可打开的 Workbench 链接。
```

宿主负责调用工具。首次创建任务会初始化缺失的索引；普通使用者不需要在目标仓库安装本工具的 npm 依赖或手工运行分析脚本。任务页能查看历史、从自然语言主张跳到证据与源码、查看变更差异，再进入图谱或 Wiki 并返回原任务。页面可见时每 10 秒读取任务修订版，也可手动刷新。

Workbench 链接默认可在生成后的 **24 小时内首次打开**；打开后浏览器会话的最长有效期和空闲超时均为 **24 小时**。链接仍为一次性，页面依赖创建链接的运行进程持续运行。通过宿主打开时需保持 MCP 运行；离开宿主后可用下面的独立回看命令。更新后需先构建或安装新版运行时、重启对应服务，再生成新链接；已经过期或使用过的旧链接不会自动续期。

接着在同一会话说明需要修改的内容。宿主实际修改源码、重新建立当前快照、执行变更检查与测试，再将真实命令、退出码、快照和结果记录到同一个 Task。源码索引不会自动完成业务理解；业务结论由宿主阅读源码后形成，并保留证据、推断理由和未知边界。确定性 Wiki 诊断稿不能充当正式知识发布。

分别确认以下状态，不要用其中一项代替另外三项：

| 状态 | 如何确认 | 未满足时下一步 |
| --- | --- | --- |
| 插件已注册 | `understand-code doctor --host codex` | 按诊断修复安装或启用状态 |
| 当前会话已连接 | 新会话实际获得并调用 Understand Code MCP 工具 | 重开目标仓库会话，核对 Host 插件配置 |
| 仓库产物有效 | 工具返回当前仓库、快照、新鲜度和范围 | 由宿主初始化或刷新产物；旧格式需迁移 |
| 任务后端已就绪 | 创建真实 taskId，并在任务页重开仍能读取 | 核对版本、平台、运行时和具体失败原因 |

`local_durable_v1` 是 macOS/Linux 的本地任务路线；显式选择的生产 Provider 仍遵守其 Linux 和安装校验要求。Windows 未列入本次本地运行时支持范围。CLI、Desktop、IDE 和跨宿主接续分别验收；具体已运行证据和未验收项目见[修复验收记录](docs/testing/2026-09-10-audit-remediation.md)，不要把本节操作说明当成已完成真实 Host 验收的证明。

### 离开宿主后回看任务

已持久化的任务不会随聊天会话结束而消失。安装 Preview 包后可以单独运行：

```sh
understand-code workbench --root /absolute/path/to/worktree --no-open
```

打开新打印的本地链接；追加 `--task-id "<TASK_ULID>"` 可直接进入已有任务，请把占位符替换为实际的 26 位任务 ID。省略 `--no-open` 时会尝试自动打开浏览器。**阅读期间保持这条 CLI 运行**，结束时按 Ctrl+C；之后再次执行可获得新链接。它与静态 `understand-code-preview --root` 查看器是不同入口，支持 macOS/Linux 本地任务运行时。

### 从任务形成正式知识库

让宿主在同一个真实 Task 上读取安装包自带的写作指南：

```sh
understand-code knowledge --root /absolute/path/to/worktree --task-id "<TASK_ULID>" --guide
```

后续每个阶段都带同一组 `--root` 和 `--task-id`。宿主按指南准备文件任务、领取批次、阅读源码并写入解释，合并后完成主题写作。`--prepare-topics` 同时生成 `.intermediate/featured-plan.json`：宿主必须按主干写作指南逐页写出计划中的总览、模块、流程和业务能力文档，保留计划的 ID、路径、必需章节和真实源码证据，汇总到 `.intermediate/featured-writer-output.json`，再用 `--finalize` 严格校验草稿。需要重新查看计划时可用 `--prepare-featured`，它只重建计划，不覆盖已有主干输出。

草稿位于 `.understand-code/knowledge-drafts/<taskId>/`；重复准备会保护已有文件/主题工作，应继续领取、合并和校验。主干缺失、身份不匹配或证据/正文质量不合格时应按 `--retry` 的错误修正，不能用确定性模板或降低门禁代替写作。安装包自带文件、主题和主干三份指南，不要求另装 slash skill，也不会自动编造业务内容或替宿主执行验证。

完成源码快照检查后，由宿主调用 MCP `refresh_index` 的 `knowledge.action=stage`，保留候选 ID 并在 Workbench 审阅。宿主执行真实验证、记录结果并将任务转为 `verified` 后，再用同一来源快照、候选 ID 和最新任务修订版显式 `publish`。确定性诊断 Wiki 不等于正式写作完成。完整阶段、快照要求和恢复说明见 [CLI 知识写作流程](packages/cli/README.md#task-knowledge-lifecycle)。

不再需要的候选或中断留下的临时写入可显式清理：

```sh
understand-code knowledge --root /absolute/path/to/worktree --task-id "<TASK_ULID>" --discard-candidate --candidate "<GENERATION_ID>"
understand-code knowledge --root /absolute/path/to/worktree --task-id "<TASK_ULID>" --cleanup-interrupted
```

前者只丢弃该任务的指定草稿候选；后者清理绑定仓库中的中断临时写入，保留完整候选。两者均需真实根目录和已有本地任务，不用于删除源码。已发布候选会归档并保留发布重放，不占待发布草稿容量。

### 长任务进度与分析边界

首次 `build_task_brief` 缺少索引时会启动独立后台作业，及时返回 `waiting_for_index`、`jobId` 与建议查询间隔；此时还没有创建 Task。宿主通过 `index_job { action: "status", jobId }` 查询，等 `completed` 后使用**完全相同的原参数和幂等键**再次调用 `build_task_brief`，创建或重放同一个任务。关闭宿主不会停止作业；回到同一仓库后可继续查询，省略 `jobId` 可读取最新作业。取消用 `index_job { action: "cancel", jobId }`；失败或中断后按阶段提示修复，再重试原始创建请求。多个宿主首次请求会复用正在运行的作业，不需要手工 shell 预热。

已有索引的建任务和显式 `refresh_index` 仍同步执行。宿主提供 `progressToken` 时会收到阶段进度；发送取消通知时，工具在可取消检查点停止并保留之前完整发布的快照。阶段不是准确百分比，已进入原子提交的操作会完成提交；后台作业需要通过 `index_job` 取消，取消已经返回的启动请求不会停止它。普通 Codex TOML 模板提供每服务 `tool_timeout_sec = 900` 用于显式长刷新，安装不会修改全局超时。

“能识别语言”不等于“所有调用关系已解析”。TS/JS 导入支持相对路径、仓库清单内的 tsconfig/jsconfig JSONC `paths`、`baseUrl` 和相对 `extends`；workspace 包需导入方显式声明 `workspace:` 依赖且包名唯一，歧义条件导出和未声明外部包不会猜测。Python/Rust 目前仅绑定同文件、唯一顶层函数的直接调用，方法、跨模块和有歧义的绑定不作推断；Java 支持保守且唯一确定的静态调用绑定，虚分派、继承目标和有歧义的重载保持未解析；Ruby/PHP/C/C++/C# 提取定义和调用位置，尚不绑定调用目标。请结合 Graph 的 `callResolution.limitations` 与源码判断，不用缺失边证明“没有影响”。细节见 [语言与关系能力边界](packages/cli/README.md#language-and-relation-boundaries)。

## 源码技能路线：先看哪一段

以下命令表与“技能版两分钟快速开始”适用于已经加载源码技能的宿主。Codex MCP 用户优先使用上面的自然语言任务路线；需要独立生成图谱、Wiki 或技能导览时，再选择本节。

| 你的目标 | 从哪里开始 | 需要的前置 | 主要结果 |
| --- | --- | --- | --- |
| 第一次看懂整个仓库 | `/understand-full --full --language zh` | 插件已启用；Node.js 22+、pnpm 10+（首次构建时） | 图谱、Dashboard、Markdown 知识库 |
| 只生成架构图 | `/understand --full --language zh`，然后 `/understand-dashboard` | 无现有图谱也可以 | `.understand-code/knowledge-graph.json` |
| 直接问代码问题 | `/understand-chat "问题"` | 先有图谱 | 基于图谱证据的回答 |
| 深入读一个文件或函数 | `/understand-explain src/path/file.ts:fn` | 先有图谱 | 组件职责、调用关系、源码解释 |
| 评估当前分支或未提交改动 | `/understand-diff` | 先有图谱和 Git diff | 改动节点、影响范围、风险、差异覆盖层 |
| 给新人生成导览 | `/understand-onboard` | 先有图谱 | 可保存为 `docs/ONBOARDING.md` 的 Markdown |
| 梳理业务域和流程 | `/understand-domain` | 可有可无图谱 | `domain-graph.json` 和流程图 |
| 从图谱生成项目 Wiki | `/understand-kb` | 先有图谱 | `.understand-code/knowledge-base/` |
| 一次跑完所有步骤 | `/understand-full` | 插件已启用 | 图谱、Dashboard、知识库及联动检查 |
| 分析已有 Karpathy 风格 Wiki | `/understand-knowledge path/to/wiki` | Wiki 有 `index.md` 和 wikilinks | Wiki 知识图谱 |

如果宿主里已经能从 `/` 自动补全看到 `understand` 或 `understand-full`，普通使用者可以跳过下面的源码构建和 Preview 安装，直接阅读[两分钟快速开始](#技能版两分钟快速开始)。Preview CLI 是给本地 MCP/发布产物查看准备的另一条路线，不是使用 slash skill 的前置步骤。

### 已有 slash skill 时的最快路径

1. 在目标仓库打开已加载源码技能的 Claude Code 会话，输入 `/understand-full --full --language zh`；其他宿主使用其实际显示的技能调用入口。
2. 首次运行时审阅并确认 `.understand-code/.understandignore`，等待图谱、知识库和 Dashboard 完成。
3. 复制终端返回的、带 `?token=` 的完整 Dashboard URL，在浏览器打开。
4. 回到同一个会话继续输入 `/understand-chat "用户登录请求从入口到数据库经过哪些组件？"`，或用 `/understand-explain path/to/file.ts:functionName` 深入阅读。

如果 `/` 自动补全里没有这些条目，先看[安装与版本路线](#安装与版本路线)和 Codex 入口说明；把源码 checkout 放进工作区不会自动注册 slash skill。

## 它会做什么，不会做什么

一次完整流程大致是：

```text
项目源码
   │
   ├─ 扫描文件、语言、框架和入口
   ├─ 分析节点、导入/调用关系、架构层和学习 Tour
   ├─ 写入 .understand-code/knowledge-graph.json
   │       ├─ Dashboard：搜索、切换关系模式、查看节点详情和源码证据
   │       ├─ Chat/Explain：围绕图谱回答和解释
   │       ├─ Domain：提炼业务域、流程和步骤
   │       └─ KB：生成可阅读的 Markdown 知识库
   └─ 后续提交或 diff：增量更新、影响分析
```

默认情况下，工具读取项目文件并只在项目的 `.understand-code/` 下写入生成物。它不会替你修改业务源码，也不会替你执行测试命令；测试或验证结果需要由宿主/用户实际运行后提供。LLM 生成的摘要、业务事实和风险判断应结合源码证据复核，不要把图谱当成运行时监控或编译器。

## 安装与版本路线

先按目标选择入口：Codex/Claude 中持续处理需求、修改和验证，使用 Preview MCP 任务路线；独立扫描与文档生成可使用已安装的源码技能。源码构建用于开发维护。

| 入口 | 当前载体 | 你会看到什么 | 适合谁 |
| --- | --- | --- | --- |
| 技能版 | 根目录 `.claude-plugin/marketplace.json`、`.claude-plugin/plugin.json` 和 `skills/*/SKILL.md` | `/understand`、`/understand-chat`、`/understand-full` 等 slash skill（具体命名空间由宿主决定） | 在聊天宿主里分析源码、看图谱和生成 Wiki |
| Preview MCP `0.1.0-preview.2` | `@understand-code/preview` tarball | stdio MCP、Codex/Claude Host wrapper、本地持久 Task 和证据工作台；另有静态 Preview 查看器 | macOS/Linux 中通过宿主处理真实仓库任务 |

这两种载体共享部分底层模型，但不是同一套用户入口。Preview Alpha 的 MCP 工具名称不能替代本手册的 slash skill；反过来，能看到 `/understand` 也不代表已经安装了 Preview CLI。

### 使用前的前置条件

- 目标仓库是本地可读目录；建议在仓库根目录打开宿主会话。
- 已安装并启用了能发现本项目 skill 的聊天宿主；模型需要能读取当前会话允许的源码上下文。
- Node.js 22+、Git 和 pnpm 在源码 checkout、缺少 `dist/` 或 Dashboard 需要现场安装依赖时是硬性前置；已经带好依赖的发行包通常不需要你在目标仓库重新安装。
- 如果要生成图谱，项目最好是 Git 仓库；工作树重定向和 commit 新鲜度判断依赖 Git。

### 使用已安装技能

如果你的 Codex、Claude Code 或其他宿主已经发现了 `understand` 技能，不需要在目标项目里手动安装 npm 依赖。打开一个位于目标仓库中的新会话，确认能看到 `/understand` 或宿主显示的命名空间版本（例如 `/understand-code:understand`），然后按快速开始操作。

**Codex 用户请先看清入口：** 当前源码 checkout 自带的是 Claude 风格的 plugin manifest；把这个目录放进 Codex 工作区不会自动注册 `/understand-*`。只有聊天框的 `/` 自动补全确实显示这些 skill 时，才走上面的 slash 路线。没有这些条目时，按下面的 Preview/Codex marketplace 流程安装；那条路线提供 MCP tools（例如 `refresh_index`、`search_context`、`trace_impact`），不会凭空增加 `/understand-*` slash 命令。

技能的实际命令名由宿主决定：有的宿主显示短名称 `/understand`，有的会加插件命名空间。以下示例使用短名称；如果宿主的自动补全显示了命名空间，请使用自动补全给出的完整名称。

### 从源码开发或首次构建

本仓库是 pnpm workspace。技能的缺失依赖提示要求 Node.js 22 或更高版本、pnpm 10 或更高版本；如果你是在维护源码而不是普通使用者，应优先遵循仓库锁文件和 CI 记录的 pnpm 版本（当前 CI 可能固定在 pnpm 9）：

```sh
node --version
pnpm --version
pnpm install
pnpm --filter @understand-code/core build
```

源码 checkout 本身不等于已经安装到宿主。构建完成后，使用宿主官方的本地插件/技能安装方式把仓库加入会话；不要把“在仓库根目录执行 `pnpm install`”误认为已经注册了 `/understand`。

#### 安装到 Claude Code

根目录同时提供 `.claude-plugin/marketplace.json` 和 `.claude-plugin/plugin.json`，因此这个仓库本身就是一个可安装的 Claude Code 插件市场。在 Claude Code 会话里执行：

```
/plugin marketplace add chifanjie/Tomato
```

```
/plugin install understand-code@understand-code
```

本地开发时把仓库路径替换成 checkout 目录即可（`/plugin marketplace add /absolute/path/to/understand-code`）。安装后重开一个会话，`/` 自动补全里会出现 `/understand`、`/understand-full`、`/understand-doctor` 等条目，`skills/`、`agents/`、`hooks/hooks.json` 由 Claude Code 自动发现。

安装前可以先校验清单：

```bash
claude plugin validate /absolute/path/to/understand-code
```

装完不确定是否可用时，运行 `/understand-doctor`：它会检查插件根目录、Node/pnpm 版本、`core` 构建产物、图谱与知识库是否存在及是否过期，并直接给出下一步命令。

Codex 仍走 `packages/host-adapters/plugin-roots/codex` 下的 marketplace 与 Preview CLI 路线；那条路线提供 MCP tools，不会增加 `/understand-*` slash skill。

内置的语言和框架提示覆盖常见的 TypeScript、JavaScript、Python、Go、Java、Rust、C/C++、C#、Ruby、PHP、Kotlin、Swift、SQL、GraphQL、Protobuf、Shell、HTML、CSS、YAML、JSON、Terraform、Dockerfile 和 Markdown 项目；框架提示包括 React、Next.js、Vue、Express、Django、FastAPI、Flask、Gin、Rails 和 Spring。这里的“支持”表示有相应的扫描/摘要指导，动态代码、生成代码和未列出的框架仍应人工复核。

### Preview CLI（可选）

Preview 包提供 Codex/Claude MCP 持久任务路线，也包含可选的静态 Graph/Wiki 查看器。它要求 Node.js 22+ 和 Git；源码构建还需要 pnpm。当前文档不假设已有公开发布的 tarball：从本仓库 checkout 生成本地安装包，输出目录请使用已存在的外部绝对目录：

```sh
pnpm install --frozen-lockfile
pnpm --filter @understand-code/preview build
pnpm --dir packages/preview pack --pack-destination /ABSOLUTE/EXISTING/OUTPUT
```

用 `pack` 实际输出的包名替换占位路径。安装后注册你使用的一个宿主，Codex 最小流程是：

```sh
npm install -g "/absolute/path/to/understand-code-preview-X.Y.Z.tgz"
understand-code --version
understand-code-preview --install-host codex
```

Claude Code 改用 `understand-code-preview --install-host claude`。该辅助命令从当前安装包定位 marketplace，调用宿主官方注册/安装命令并运行对应的 Doctor；`codex` 或 `claude` CLI 本身须已安装并在 `PATH` 上。它不会自动安装宿主、登录账号或证明当前聊天已连接。每次安装或升级后打开目标 Git 仓库中的新 Host 会话，按本文开头的自然语言任务路线操作。手动注册、升级、恢复、卸载及严格的构建校验见 [Preview 生命周期说明](packages/preview/README.md)。

Preview 安装提供 MCP tools，不会增加 `/understand-*` slash skill。在 macOS/Linux 且未显式选择生产 Provider 时，Host wrapper 启动本地持久运行时，无需额外开关。首次创建任务可初始化缺失索引；宿主负责调用 `build_task_brief`、证据/搜索工具及 `open_workbench`，修改后执行刷新、`check_change` 与 `record_verification`。这些是 MCP 工具，不是 shell 子命令。旧版 Preview `.1` 的 `provider_unavailable` 不能通过重复注册消除；升级后用新会话验证。

需要直接启动 MCP 时使用：

```sh
understand-code mcp --stdio --root /absolute/path/to/worktree
```

只想查看内置示例或已有发布产物时，可选静态查看器：

```sh
understand-code-preview --demo
understand-code-preview --root /absolute/path/to/worktree
```

静态 `--root` 要求规范的 Git worktree 根目录、与当前 `HEAD` 匹配的已发布图谱和满足完整性检查的干净启动快照；存在 staged、unstaged、untracked、冲突或过期产物会拒绝启动。这个限制不适用于上面的 MCP 本地任务路线。已有任务的独立回看使用 `understand-code workbench`，不是静态查看器。完整参数与能力边界见 [CLI 文档](packages/cli/README.md)。

## 技能版两分钟快速开始

### 1. 在目标仓库会话中运行完整流程

进入要分析的仓库根目录，或者把仓库路径作为第一个参数传给技能：

```text
/understand-full --full --language zh
```

指定其他目录也可以：

```text
/understand-full /absolute/path/to/my-repo --full --language zh
```

首次运行会先检查项目路径和依赖，并生成或要求你审阅 `.understand-code/.understandignore`。确认忽略规则后才会开始扫描。这个停顿是有意的：误把 `src/`、`app/` 或业务配置加入忽略列表，会让后面的图谱缺少关键节点。

### 2. 等待三个可见结果

完整流程结束时，你应能看到：

```text
图谱: <项目>/.understand-code/knowledge-graph.json
知识库: <项目>/.understand-code/knowledge-base/
Dashboard: http://127.0.0.1:<端口>/?token=<令牌>
```

复制完整的 Dashboard URL，尤其是 `?token=<令牌>`。只复制 `http://127.0.0.1:<端口>/` 会触发 “Access Token Required”，页面无法读取图谱。

### 3. 立刻试三个问题

```text
/understand-chat "用户登录请求从入口到数据库经过哪些组件？"
/understand-explain src/auth/service.ts:login
/understand-diff
```

最后一个命令适用于已经存在 Git 改动的项目；首次分析没有改动时，先用前两个命令熟悉图谱。

### 不想生成知识库时

只运行图谱和 Dashboard：

```text
/understand --full --language zh
/understand-dashboard
```

只想以后再启动 Dashboard：

```text
/understand-full --full --language zh --no-dashboard
```

### 在 Codex/Claude 对话里怎么输入

这些 `/understand-*` 是聊天宿主里的 slash skill，不是直接粘贴到普通终端执行的 shell 命令。实际操作顺序是：

1. 打开对应目标仓库的项目或任务，确认会话工作目录就是要分析的仓库。
2. 在聊天输入框键入 `/`，从自动补全中选择 `understand-full`（如果宿主显示命名空间，就选择类似 `/understand-code:understand-full` 的条目）。
3. 在参数位置输入 `--full --language zh`，发送后等待阶段进度和最终路径。
4. 在浏览器打开终端返回的、带 `?token=` 的 Dashboard URL。
5. 回到同一个对话，继续选择 `/understand-chat`、`/understand-explain` 或 `/understand-diff` 提问。

如果你是在终端里操作，应使用 Preview/CLI 的 `understand-code ...` 命令；不要把 slash skill 文本当作 shell 命令运行。宿主自动补全是判断当前安装版本和命名空间的准确信号。

## 命令速查

### `/understand`：生成或更新代码知识图谱

```text
/understand [path] [--full] [--auto-update|--no-auto-update] [--review] [--language <lang>]
```

它扫描项目文件，分析代码/配置/文档节点、导入和调用关系，构建架构层与学习 Tour，并写入 `.understand-code/knowledge-graph.json`。

常用选项：

| 选项 | 作用 | 什么时候用 |
| --- | --- | --- |
| `path` | 分析另一个目录；相对路径按当前会话目录解析 | 不在项目根目录，或只想分析一个子目录 |
| `--full` | 忽略现有图谱，完整重建 | 首次分析、忽略规则改了、图谱明显过期或缺节点 |
| `--review` | 用完整 LLM graph reviewer 做额外审查 | 需要更严格的图谱质量检查，能接受更高耗时/成本 |
| `--language zh` | 让摘要、标签、标题和课程提示使用简体中文 | 团队主要使用中文；默认也是 `zh` |
| `--language en` / `ja` 等 | 切换输出语言；支持 ISO 639-1 和部分友好名称、区域变体 | 多语言团队或需要英文文档 |
| `--auto-update` | 写入 `config.json`，让提交后的 hook 检查并增量更新 | 希望每次提交后自动维护图谱 |
| `--no-auto-update` | 关闭自动更新标志 | 只想手动维护图谱 |

如果当前 commit 已经有图谱，工具会判断：

- commit 未变化时，询问你要完整重建、运行 reviewer，还是结束；
- commit 有变化时，默认只重新分析变化文件，并在需要时重建架构和 Tour；
- `--full` 始终覆盖这个决策，重新跑完整流程。

扫描到超过 100 个文件时，技能也会先提示可能的耗时，并建议用子目录缩小范围；这是确认门，不是死锁。大型仓库确认继续后，观察批次进度和最终 warnings 即可。

成功结束时，摘要应包含扫描/分析的文件或批次数、图谱保存路径和 warnings（如果有）。看到“部分结果已保存”时，先阅读 warnings 再决定是否完整重建；不要只看进程退出就认为所有文件都已覆盖。

校验通过后，部分宿主/技能路径会自动继续启动 Dashboard；如果没有返回 URL，不代表图谱丢失，直接运行 `/understand-dashboard` 并使用同一个项目路径即可。

### `/understand-dashboard`：打开交互式 Dashboard

```text
/understand-dashboard [project-path]
```

它要求目标目录已经有 `.understand-code/knowledge-graph.json`，随后启动本地 Vite 服务。输出的 URL 必须完整保留 `?token=` 参数。端口 `5173` 被占用时会自动选择下一个可用端口。

Dashboard 中常见的阅读顺序是：

1. 先看项目总览、架构层和 Tour，建立全局地图；
2. 用名称、路径或对象 ID 搜索节点；
3. 点击节点查看职责、类型、路径、源码行号、上游/下游关系和关联文档；
4. 在图谱工具栏按当前数据选择“架构总览”“调用关系”（没有调用边时会显示“文件依赖”）或“文档覆盖”；
5. 有知识库时，从顶栏的“知识库”进入“主干阅读”“代码参考”和“知识库状态”，或按 `Ctrl+K` / `⌘K` 搜索。

`/understand-domain` 生成的 `domain-graph.json` 是独立产物。不同宿主/版本对 Domain 专用视图的接入可能不同；如果当前 Dashboard 没有业务域入口，请直接检查该 JSON，或以 `/understand-domain` 的文本结果为准，不要把“关系图谱”里的普通架构模式误认为业务流程图。

如果 Dashboard 显示 token gate，先确认 URL 没有被聊天软件截断；也可以把终端打印的令牌手动粘贴到页面中。

### `/understand-chat`：基于图谱提问

```text
/understand-chat "问题"
```

它先在图谱的 `name`、`summary`、`tags` 和 `languageNotes` 中找匹配节点，再沿一跳 `imports`、`calls`、`depends_on` 等边读取上下文和架构层。文件路径主要用于结果展示和 `/understand-explain` 的精确定位，路径本身不一定是 Chat 的搜索字段。适合问：

```text
/understand-chat "HTTP 请求的入口、鉴权中间件和错误处理在哪里？"
/understand-chat "订单状态在哪些模块之间流转？"
/understand-chat "这个仓库的配置从哪里加载，谁会修改它？"
/understand-chat "哪些组件依赖 src/payment/？"
```

它不是全仓库全文搜索，也不会自动读取没有进入图谱的文件。问题没有命中时，换成精确的文件名、函数名、目录名或标签；仍然不准确就先重新运行 `/understand --full`。

正常回答会说明命中的节点/路径，并用导入、调用或依赖关系解释结论；如果只找到相近标签，回答应明确这是有限上下文推断。

### `/understand-explain`：深度解释文件、函数或模块

```text
/understand-explain src/api/router.ts
/understand-explain src/api/router.ts:registerRoutes
```

它会结合目标节点的父子节点、相邻边、所属架构层和实际源码解释：职责、内部结构、外部依赖、输入输出、数据流、设计模式和复杂度。路径尽量使用仓库相对路径；函数格式使用 `文件路径:函数名`。

可把输出当作“职责 → 输入/输出 → 调用链 → 源码证据”的阅读提纲；若目标函数没有被图谱提取，工具会告诉你未命中，而不是凭空补全实现。

### `/understand-diff`：评估改动影响

```text
/understand-diff
```

它先读取当前未提交 diff，或当前分支相对基线的变更，再把变更文件映射到图谱节点，找一跳影响关系和受影响架构层，最后写入：

```text
.understand-code/diff-overlay.json
```

结果通常包含：直接改动组件、受影响组件、跨层关系、复杂度/爆炸半径线索和建议重点检查的地方。改动前后如果图谱 commit 不一致，先运行 `/understand`；否则影响范围可能只是旧结构的近似。

### `/understand-onboard`：生成新人导览

```text
/understand-onboard
```

它从项目元数据、架构层、Tour、文件节点和复杂度热点生成 Markdown。技能会把内容返回给你并提示保存；建议保存为：

```text
docs/ONBOARDING.md
```

保存后可以提交到团队仓库。图谱本身通常是本地生成物，导览文档才适合作为稳定的团队资料。

### `/understand-domain`：提炼业务域和流程

```text
/understand-domain
/understand-domain --full
```

已有代码图谱时，它直接从图谱推导业务域、业务流程和步骤；没有图谱时，会做一次轻量扫描，读取入口、导出、导入和关键代码片段，再生成分析结果。`--full` 强制重新扫描。产物是：

```text
.understand-code/domain-graph.json
```

完成后技能会尝试启动 Dashboard；无代码图谱时这一步可能因为 Dashboard 的前置条件而降级。要稳定查看图谱，先运行 `/understand`，再手动运行 `/understand-dashboard`；当前版本是否提供 Domain 专用入口以实际宿主 UI 为准，并可直接检查 `domain-graph.json`。

### `/understand-kb`：从图谱生成 Markdown 知识库

```text
/understand-kb [project-path] [--parallel 1|2] [--resume] [--include-extended-topics] [--deterministic-only] [--max-source-mb <n>]
```

它要求先有 `.understand-code/knowledge-graph.json`，默认写入：

```text
.understand-code/knowledge-base/
```

建议第一次使用默认的 `--parallel 1`，先保证内存和质量；明确需要提速时再使用 `--parallel 2`。中断后用 `--resume` 从租约队列继续，遇到失败批次可在高级排错中使用 `--retry`。`--include-extended-topics` 会在必需主题完成后再生成扩展主题；`--deterministic-only` 适合优先要到确定性的文件覆盖和索引，不包含完整的写作者工作流质量。`--max-source-mb <n>` 限制单个源码证据包的大小，适合超大文件或内存紧张时使用；通常先保留默认值。

`/understand-full` 使用的是包装层参数 `--deterministic-kb`；直接运行 `/understand-kb` 时才使用 `--deterministic-only`。不要把两者混写。

成功结果至少应能在输出目录看到 `目录.md`、`项目总览.md` 和 `覆盖报告.md`；默认工作流还会生成 `业务流程地图.md`、文件文档、主题专题和 `.trace/` 报告。先打开 `覆盖报告.md` 判断覆盖是否达标，再把 Markdown 交给团队阅读。

### `/understand-full`：一键完整流程

```text
/understand-full [project-path] [--full] [--review] [--language <lang>] [--parallel 1|2] [--resume] [--deterministic-kb] [--include-extended-topics] [--no-dashboard]
```

它按顺序执行：图谱 → Dashboard → Markdown 知识库 → Dashboard 联动检查。`--no-dashboard` 只跳过启动和联动验证；图谱和知识库仍会生成。完整流程会检查图谱端点和知识库 profile；如果生成了业务能力索引，也会检查它能否用同一个 token 访问，缺失时报告降级警告而不是把整个流程判定为失败。

判断成功的依据是同时拿到图谱路径、知识库路径和带 token 的 Dashboard URL，并看到联动检查结果；任何一个阶段失败时，先按阶段名称排错，不要把残留的旧目录当成这次运行的产物。

### `/understand-knowledge`：分析已有 Wiki

```text
/understand-knowledge [wiki-directory]
```

这个入口针对 Karpathy 风格的三层 Wiki：`raw/` 原始资料、Wiki Markdown、`index.md`/schema 配置和 wikilinks。它不是 `/understand-kb` 的别名：前者把已有 Wiki 反向整理成图谱，后者把代码图谱生成 Wiki。目标目录至少应有 `index.md` 和带 `[[链接]]` 的 Markdown 文件。

它会把验证后的图谱写回目标目录的 `.understand-code/knowledge-graph.json`。如果目标目录已经有代码图谱，先备份或使用专门的临时目录，避免把代码图谱和 Wiki 图谱互相覆盖。

## 仓库里有什么

如果你需要从“使用者”进一步了解实现，可以按下面的地图找文件：

```text
Understand-Code/
├── skills/                    # 用户可调用的 /understand-* 入口和执行规范
│   ├── understand/            # 扫描、分析、装配、校验和增量更新
│   ├── understand-full/       # 图谱 → Dashboard → 知识库的一键编排
│   ├── understand-kb/         # Markdown 知识库生成器和覆盖报告
│   └── understand-*/          # chat、explain、diff、domain、onboard 等入口
├── agents/                    # scanner、file-analyzer、architecture、writer、reviewer 提示
├── hooks/                     # 支持宿主的 SessionStart/PostToolUse 自动更新钩子
├── packages/core/             # 图谱 schema、解析器、语言和框架配置
├── packages/dashboard/        # 本地 Vite Dashboard
├── packages/cli/              # 低层 stdio MCP server
├── packages/preview/          # 可打包的 Alpha Preview CLI/MCP
└── src/                       # chat、diff、explain、onboard 上下文构建器
```

日常使用通常只需要 `skills/` 提供的入口；只有在修改解析器、Dashboard、CLI 或 writer 时，才需要阅读对应的 `packages/` 和 `agents/`。`hooks/auto-update-prompt.md` 标记为内部 hook 提示，不应当被当作手动命令直接执行。

## 按任务照做

### 场景 A：第一次接手一个 TypeScript 或 Python 项目

```text
/understand-full --full --language zh
```

等待图谱和 Dashboard URL 出现后：

```text
/understand-chat "项目的启动入口在哪里？请求经过哪些层？"
/understand-onboard
/understand-explain src/<你关心的文件>.ts
```

检查 `docs/ONBOARDING.md` 是否需要补充人工背景，再把它提交给团队。遇到节点缺失，先回到 `.understand-code/.understandignore` 检查排除规则。

### 场景 B：只想看架构，不生成完整 Wiki

```text
/understand --full --language zh
/understand-dashboard
```

先在 Dashboard 看层和 Tour，再点击一个入口节点，沿 imports/calls 关系展开。需要业务视角时追加：

```text
/understand-domain
```

### 场景 C：提交前评估风险

先保证图谱对应当前代码基线，然后修改代码并运行：

```text
/understand-diff
/understand-dashboard
```

在 Dashboard 中查看差异覆盖层；在回答审查意见时引用 `changedFiles`、`changedNodeIds`、`affectedNodeIds` 和受影响层。若改动很大或图谱过期，先 `/understand --full`，再重新生成 diff。

### 场景 D：大仓库或 Monorepo

先在仓库根运行一次，检查默认忽略规则和输出量：

```text
/understand --full --language zh
```

如果只需要某个边界清晰的子项目，可以把路径传给支持路径参数的技能：

```text
/understand packages/order-service --full --language zh
```

然后在同一个项目会话/工作目录中运行 Chat、Explain、Onboard 或 Domain；只有 Dashboard、KB 和 Full 这类入口明确支持项目路径参数时，才再次传同一个路径。注意工作树重定向规则可能把输出放到主仓库根；见[路径和 Worktree](#路径和-worktree)。知识库优先使用 `--parallel 1`、`--resume`，不要为了速度盲目增加并发。

### 场景 E：只生成中文或英文资料

```text
/understand --full --language zh
# 或
/understand --full --language en
```

语言偏好会写入 `.understand-code/config.json` 的 `outputLanguage`，后续增量分析会沿用。区域变体可以使用 `zh-TW`、`zh-HK` 等；没有对应 locale 文件时仍会使用语言指令和通用技术术语。

## 结果在哪里

典型目录如下（文件数量会因项目和生成模式变化）：

```text
<project>/.understand-code/
├── knowledge-graph.json       # 代码/配置/文档节点、边、层、Tour
├── domain-graph.json          # 可选：业务域、流程、步骤
├── meta.json                   # 分析时间、Git commit、版本、文件清单
├── config.json                 # outputLanguage、autoUpdate 等偏好
├── fingerprints.json           # 增量更新使用的结构指纹
├── diff-overlay.json           # /understand-diff 的改动覆盖层
├── .understandignore           # 本项目的分析排除规则
├── intermediate/               # 运行中的批次和临时结果
├── tmp/                        # 验证脚本等临时文件
└── knowledge-base/             # /understand-kb 的 Markdown Wiki
    ├── 目录.md
    ├── 项目总览.md
    ├── 架构地图.md
    ├── 业务流程地图.md
    ├── 待确认项.md
    ├── 覆盖报告.md
    ├── 业务能力索引.md
    ├── knowledge-base-profile.json # Dashboard/联动使用的机器索引
    ├── wiki-index.json             # 文档目录和版本索引
    ├── search-index.json           # 知识库搜索索引
    ├── 索引/
    ├── 模块总览/
    ├── 业务流程/
    ├── 业务能力/
    ├── 文件文档/
    ├── 关键函数专题/
    ├── .trace/
    └── .intermediate/
```

Markdown 是给人读的入口，`knowledge-base-profile.json`、`wiki-index.json`、`search-index.json` 和 `.trace/` 是 Dashboard 与覆盖校验使用的机器数据；不要只保留 Markdown 后删除这些 JSON，否则知识库页面可能显示为空或无法联动。

仓库的 `.gitignore` 默认忽略 `.understand-code/`，因为它是随源码版本变化的本地缓存。若团队需要共享稳定资料，通常提交 `docs/ONBOARDING.md` 或精选的知识库导出，并在评审中注明对应的 Git commit；不要把过期图谱当作当前源码事实。

## 图谱怎么读

图谱顶层常见字段是：

| 字段 | 含义 |
| --- | --- |
| `project` | 项目名、描述、语言、框架、分析时间和 Git commit |
| `nodes` | 文件、函数、类、模块、配置、服务、端点、Schema、文档等节点 |
| `edges` | `imports`、`calls`、`contains`、`depends_on`、`configures`、`documents` 等关系 |
| `layers` | API、Service、Data、UI、配置等架构分组（名称由项目内容决定） |
| `tour` | 推荐的学习顺序，每一步关联要看的节点 |

需要在终端快速核对时，可以用 `jq`：

```sh
jq '.project' .understand-code/knowledge-graph.json
jq '.layers[] | {name, count: (.nodeIds | length)}' .understand-code/knowledge-graph.json
jq '.nodes[] | select(.filePath == "src/index.ts")' .understand-code/knowledge-graph.json
jq '[.edges[] | select(.source == "file:src/index.ts")]' .understand-code/knowledge-graph.json
```

节点是静态分析和模型整理的结果，关系可能因为动态 import、反射、代码生成或未支持的语言特性而不完整。遇到关键链路时，使用 `/understand-explain` 让工具回到实际源码核对。

## 问什么，得到的答案更可靠

把对象、动作和范围写进问题，比只写“这个项目怎么工作的”更容易命中图谱：

| 想知道什么 | 可直接改写的提问 |
| --- | --- |
| 入口和调用链 | `从 src/api/router.ts 的 registerRoutes 开始，请追踪到持久化层，并列出跨层边。` |
| 配置来源 | `配置 X 在哪些文件定义、读取和覆盖？请标出环境变量与默认值。` |
| 数据流 | `订单状态从 endpoint A 到 worker B 经过哪些转换和校验？` |
| 影响范围 | `我修改了 src/payment/，哪些调用方和测试可能受影响？` |
| 新人阅读顺序 | `按 Tour 和架构层给我一个先读 5 个文件的顺序，并说明每个文件的职责。` |
| 业务流程 | `支付失败后的补偿流程包含哪些 domain、flow 和 step？` |

对 Explain 使用完整相对路径；对 Chat 则优先补充函数名、类名、端点、配置键或节点标签。若路径没有命中，换成文件名/符号名再问。如果问题涉及“当前改动”，先更新图谱并运行 `/understand-diff`，不要让 Chat 猜测未提交 diff。

## 配置与持续更新

### 自动更新

运行：

```text
/understand --auto-update
```

会在 `.understand-code/config.json` 写入 `"autoUpdate": true`。当前仓库的 `hooks/hooks.json` 是随支持该 hook 的插件宿主加载的，主要依赖 Claude 的插件上下文；其他宿主未必会自动触发。触发时 hook 会先用确定性的结构指纹判断：只有新增/删除函数、类、导入、导出等结构变化才升级到需要 LLM 的增量分析；纯格式、内部逻辑或非源码变化可以只更新 metadata。宿主没有触发 hook 时，直接手动运行 `/understand` 即可。需要关闭时运行：

```text
/understand --no-auto-update
```

自动更新不是 CI 的完整质量门禁，也不会替你执行测试。重大目录重组、忽略规则变化或图谱质量异常时，显式运行 `/understand --full`。

### `.understandignore`

首次运行生成的文件包含内置排除项和根据项目目录推断的建议。内置规则通常排除 `node_modules/`、`.git/`、`dist/`、`build/`、锁文件、压缩资源和二进制文件；建议部分需要你确认后才启用。规则语法接近 `.gitignore`，也可用 `!` 强制包含文件。

排除规则的取舍：

- 排除测试、示例或生成目录可以减少时间和噪声；
- 排除入口、路由、配置、迁移或领域模型会让依赖链和业务流程断裂；
- 改完规则后建议 `--full`，否则旧节点可能继续留在图谱里。

### 路径和 Worktree

技能会检查目标路径是否位于 Git worktree。默认将输出重定向到主仓库根，因为临时 worktree 结束后其中的 `.understand-code/` 也会消失。运行时会打印检测和重定向位置。若你明确需要每个 worktree 独立生成图谱，可在宿主环境设置：

```sh
UNDERSTAND_NO_WORKTREE_REDIRECT=1
```

这会改变结果位置和后续查找路径；只在你能管理这些本地产物时使用。

## 性能、成本和隐私边界

- 首次完整分析比增量分析慢；`--review`、业务域分析和知识库写作者会增加模型调用。
- `/understand` 的文件分析、架构分层、Tour 和可选 reviewer 会把必要的源码上下文交给当前宿主配置的模型；扫描、结构指纹和图谱校验是确定性步骤。`/understand-kb --deterministic-only` 走确定性生成路径，适合先验证覆盖和目录；默认 KB 工作流会调用写作者来生成更丰富的自然语言专题。
- 大仓库先审阅 `.understandignore`，再考虑分目录分析；知识库使用 `--parallel 1` 起步，内存充足且确实需要速度时才升到 `2`。
- `--deterministic-only` 更偏向快速、可重复的覆盖和索引；需要自然语言主题质量时使用默认 `/understand-kb` 工作流。
- 会话所使用的模型/宿主可能会读取被纳入分析的源码。先把密钥、凭据、客户数据和不应外发的目录加入忽略规则，并在团队策略允许的范围内使用。
- 工具不会把源码改写成补丁，也不会把验证命令的结果伪装成已执行；生成的摘要和风险仍应由负责代码的人复核。

## 排错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `No knowledge graph found` | 目标目录没有图谱 | 先运行 `/understand --full`，再运行 chat/explain/kb/onboard/diff |
| 同一个 commit 不重新分析 | 增量决策认为图谱仍对应当前 commit | 明确运行 `/understand --full`，或选择 `--review` |
| Dashboard 显示 `Access Token Required` | URL 丢了 `?token=`，或令牌被截断 | 从终端重新复制完整 URL；必要时手动粘贴 token |
| Workbench 提示“请从宿主重新打开工作台链接。” | 启动链接或浏览器会话已失效，或 MCP 运行进程已重启 | 让宿主再次调用 `open_workbench`，打开新的一次性链接；新版首次打开期限及浏览器会话最长有效期均为 24 小时，使用时保持 MCP 进程运行。升级后需重启服务并重新生成链接 |
| Dashboard 没有知识库 | KB 尚未生成、路径不一致或仍在生成 | 检查 `.understand-code/knowledge-base/`，使用同一个项目路径重新运行 `/understand-kb` |
| 知识库中断或有失败批次 | 进程中止、内存不足或某个 writer 批次失败 | 先运行 `/understand-kb --resume`；需要诊断时使用高级 `--retry`，查看 `覆盖报告.md` 和 `.trace/generation-report.json` |
| 图谱节点明显少 | `.understandignore` 排除了源码，或图谱来自旧 commit | 检查忽略文件，确认 `meta.json`，然后 `/understand --full` |
| `Cannot find the understand-code plugin root` | 宿主技能指向了失效的源码/插件安装路径 | 确认插件已安装，Node/pnpm 可用；源码开发时先 `pnpm install` 并构建 core，再按宿主方式重新注册 |
| 提示缺少 `pnpm` 或 Node 版本过低 | 首次运行需要构建本地包 | 安装 Node.js ≥22、pnpm ≥10 后重试 |
| 运行停在确认或阶段切换处 | 正在等待 `.understandignore`、大文件数确认，或某个阶段正在重试 | 阅读当前阶段提示并确认；失败时查看最终 warnings。技能会重试一次并尽量保存部分图谱，不要直接删除整个项目目录 |
| worktree 中找不到结果 | 默认发生了主仓库重定向 | 在主仓库根查找 `.understand-code/`，或设置 `UNDERSTAND_NO_WORKTREE_REDIRECT=1` 后重新运行 |
| Chat 回答泛泛或找不到函数 | 图谱搜索只命中了有限节点，或函数未被静态提取 | 用完整相对路径/函数名提问，运行 `/understand-explain`，必要时完整重建 |
| `/understand-diff` 影响范围不可信 | 图谱的 Git commit 与 diff 基线不一致 | 先更新图谱，再重新运行 diff |

### 最小自检

```sh
test -f .understand-code/knowledge-graph.json
jq -e '.project and (.nodes | type == "array") and (.edges | type == "array")' \
  .understand-code/knowledge-graph.json >/dev/null
test -f .understand-code/meta.json
```

如果这些检查通过但 Dashboard 仍打不开，优先检查终端中的端口和 token，而不是删除源码目录。

## 常见问题

### 为什么很多命令都要求先运行 `/understand`？

`chat`、`explain`、`diff`、`onboard` 和 `kb` 使用图谱中的节点、边、层或 Tour。没有图谱时它们无法可靠地定位上下文；`domain` 是例外，它可以在没有图谱时做轻量扫描。

### 能不能只分析一个子目录？

可以，把路径作为第一个非选项参数，例如 `/understand packages/api --full`。Dashboard、KB 和 Full 明确支持项目路径时传同一个路径；Chat、Explain、Onboard 在该目标项目会话中运行，Domain 固定使用当前工作目录。这样可以避免 Dashboard 读取另一个目录的图谱。

### 为什么图谱和知识库没有自动提交到 Git？

它们绑定具体源码 commit，属于可重建的本地产物，项目默认通过 `.gitignore` 排除。需要团队共享时，提交稳定的 onboarding 或精选 Wiki，并记录生成时的 commit。

### 可以把 Dashboard URL 发给别人吗？

它是本机 `127.0.0.1` 地址，只能在能访问这台机器且拥有令牌的环境中使用。不要把 token 当作公开链接；停止本地服务后 URL 也不再可用。

### `/understand-full` 失败后需要从头开始吗？

图谱阶段失败时先修复图谱问题；知识库阶段失败通常可使用 `--resume` 继续。检查 `覆盖报告.md`、`.trace/generation-report.json` 和终端中明确指出的阶段，再决定是否 `--full` 重建。

### 如何切换语言？

首次或需要重建时使用 `/understand --full --language zh`、`en`、`ja` 等。偏好会写入 `.understand-code/config.json`，后续增量更新会继承；改语言后建议完整重建，以免新旧摘要混杂。

## 开发者与验证

如果你要修改技能、生成器或 CLI，而不是只使用它们：

```sh
pnpm --filter @understand-code/cli typecheck
pnpm --filter @understand-code/cli test
pnpm --filter @understand-code/cli build
```

技能行为的权威说明在：

- [`skills/understand/SKILL.md`](skills/understand/SKILL.md)：扫描、增量、图谱装配和校验；
- [`skills/understand-full/SKILL.md`](skills/understand-full/SKILL.md)：完整编排和 Dashboard 联动；
- [`skills/understand-kb/SKILL.md`](skills/understand-kb/SKILL.md)：知识库队列和覆盖验证；
- [`agents/knowledge-graph-guide.md`](agents/knowledge-graph-guide.md)：图谱字段、节点/边类型和 `jq` 查询；
- [`packages/cli/README.md`](packages/cli/README.md)：低层 stdio MCP 服务、工具契约和运行时；
- [`packages/preview/README.md`](packages/preview/README.md)：Preview tarball、Host lifecycle、Doctor 和发布约束。

当前维护仓库是 `chifanjie/Tomato`；上游来源与版权见 [NOTICE](NOTICE.md)。如果你使用的是公司镜像或 fork，请以实际安装源和版本为准；当前手册中的相对链接只保证在源码仓库内有效。

## 这份手册如何维护

每次新增技能、改变参数、修改输出路径或改变 Dashboard token 行为时，都应同时更新本文件和对应的 `SKILL.md`。用户最需要看到的是“前置条件 → 可复制命令 → 预期结果 → 生成文件 → 下一步”；只写内部阶段而不写这条闭环，会让使用者不得不再次询问如何开始。
