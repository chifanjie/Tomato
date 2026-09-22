# 2026-09-21 隔离 Host 安装与工具链验收

本轮使用本机真实 Codex/Claude CLI，在临时用户目录中完成官方插件安装、Doctor 和安装缓存内的 MCP 工具调用。另使用默认已认证的 Codex 完成一次有界真实模型尝试，确认模型实际调用 MCP、创建并重读任务；**完整三任务聊天旅程尚未完成**。没有控制浏览器，也没有读取、复制或打印用户凭据。

## 运行环境与对象

- macOS，Node.js `26.0.0`。
- Codex CLI `0.155.0-alpha.9.2`；Claude Code `2.1.202`。
- Preview `0.1.0-preview.2`，使用本轮开始前已经完整构建的 `packages/preview/dist`。
- 已测 CLI bundle SHA-256：`6e00d311bba5da750c005fb3bb101fe018a07b646a71359d5c5ba929d4ca7dc6`。
- 源码 installer 的新增恢复提示由本轮测试直接验证；后续源码改动重新打包后，应复跑对应入口，不能把此 hash 的验收外推到其他包。

Host 子进程使用独立的 `HOME`、`CODEX_HOME` 或 `CLAUDE_CONFIG_DIR` 与 XDG 目录；npm 安装使用临时 prefix，运行器也使用临时 npm cache。真实宿主的全局插件配置和缓存没有被更改。测试只把公开可执行文件路径带入隔离环境，不带认证环境变量。

## 实际结果

运行：

```sh
node --test --test-concurrency=1 \
  test/host-install.test.mjs \
  test/host-install-isolated.test.mjs \
  test/plugin-clean-install.test.mjs
```

工作目录为 `packages/preview`。运行器显式设置 `RUN_STEP16_DUAL_HOST_E2E=0`、`UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS=1`，并提供已发现的两个 Host CLI 绝对路径；没有启用 Provider/浏览器的可选验收分支。

结果：**15 项中 13 项通过，0 失败，2 项 Linux 专属 execve 测试因当前 macOS 跳过**；总耗时约 81.1 秒。

| 检查 | 真实执行的范围 |
| --- | --- |
| 安装辅助入口 | 当前源码 `installPackagedHost` 驱动复制到临时含空格路径的包产物，分别调用真实 Codex/Claude 官方注册命令与 Doctor；两者均 healthy。不是用伪造 Host 输出来证明安装成功。 |
| npm/插件生命周期 | 从现有 dist 打包，安装到临时 npm prefix，经官方 Host CLI 注册、升级、固定版本恢复和卸载；校验版本与插件活动缓存路径。 |
| 安装缓存 MCP | 实际从 Host 安装缓存启动 MCP，完成初始化与工具发现、建立索引、创建任务、幂等重放和重读；同一仓库的持久任务在版本生命周期中继续可读。MCP 调用由测试客户端发起。 |
| 目录与写入边界 | 中文及空格路径、linked worktree、子目录入口、缺失/错误根目录、环境重定向及不合法变更均有断言；源码和 Git index 未被任务操作改写。 |
| 失败恢复 | 缺失 Host CLI、缺失包内容、部分注册失败、Doctor 失败有明确下一步；只有 Doctor 成功后才打印安装已检查。恢复命令保留已完成步骤，正确引用含空格和单引号路径。 |
| 错误诊断 | 旧的 `internal_error` 单行断言已更新到结构化 errorId/category/phase；仍断言非零退出、无 stdout 污染及内部路径不泄漏。 |

本轮原始日志位于临时目录 `understand-host-acceptance-final-bwa8b7xm/host-acceptance.tap`，对应结果 JSON 的退出码为 0。临时目录不是长期留存介质；本文件保留范围、版本、bundle hash 和结果摘要。

新增真实辅助入口测试已加入 Preview `test:plugins`；错误恢复测试属于 `test:runtime` 原有的 `host-install.test.mjs`。

主任务随后以最终 bundle `dd0bbbc378ca43da6b4e381da0a0ad7606971306db345225b1886087a5c2d9cb` 重跑并确认隔离安装辅助入口与官方双 Host 插件生命周期通过。该批合并 24 项当时为 21 通过、1 项 cold-pack 清单断言待修、2 项 Linux 跳过；这里仅将已通过的入口与生命周期结果归于新 hash。完整 cold-pack 最终结果由主任务总报告单独记录，不能从这些部分通过结果推导。

## 默认认证与真实 Codex 模型尝试

全新临时配置下两个 Host 均未认证，只能说明隔离环境的状态。随后仅通过官方只读 `codex login status` / `claude auth status --json` 检查默认配置，保留布尔值和认证方式：**Codex 已登录，方式为 ChatGPT；Claude 未登录，方式为 none**。没有保存账户身份或凭据，也不需要为这次 Codex 验收重新登录。

真实会话使用最终构建的 `/Users/example/understand-code/packages/preview/dist/understand-code.mjs`，SHA-256 为 `dd0bbbc378ca43da6b4e381da0a0ad7606971306db345225b1886087a5c2d9cb`，与上面的隔离安装测试对象区分记录。临时 Git fixture 只有购物车金额、运费和收据函数，以及四项无依赖 Node 测试；没有发送已有业务仓库代码。

启动方式为 `codex exec --ignore-user-config --ignore-rules --ephemeral --sandbox workspace-write --json -C <fixture>`，通过一次性 `-c mcp_servers=...` 指向上述绝对路径和 fixture 根目录，指定 MCP 工具 allowlist；不覆盖模型，沿用 CLI 默认模型。保留默认认证目录供官方 CLI 自行使用，将 `sqlite_home`、`log_dir` 指向临时目录并关闭 history 持久化，没有执行全局插件安装或修改全局配置。参数能力见 [Codex 非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)、[配置参考](https://learn.chatgpt.com/docs/config-file/config-reference) 和 [MCP 配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。这次真实请求使用了现有 ChatGPT 认证；未获得最终 usage 数据，无法量化额度消耗。

提示要求连续完成三个独立任务：解释 `receipt` 链路；修复金额恰好 100 时应免运费的边界；为收据添加 `currency: 'USD'`。修改任务必须实际运行测试、调用 `check_change` / `record_verification`，最后重读任务状态。运行器只启动一次，设置 180 秒总时限，没有另起模型会话重试。

实际证据：

| 检查 | 观察结果 |
| --- | --- |
| 模型传输 | 起初发生 `request timed out`，CLI 内置重连后由 WebSocket 切换到 HTTPS；切换后模型开始读取 fixture 并调用 MCP。不能将这个传输错误解释为产品 MCP 失败或未认证。 |
| 真实工具调用 | JSONL 中有四次 `mcp_tool_call` 的 started/completed 对：`build_task_brief`、`get_repo_pulse`、`get_evidence`、`get_task_brief`。四次均为 `completed`，没有工具 error；不是测试客户端模拟调用。 |
| 持久任务 | Task `42C24JTFJGTSAA34GASS5K4K0R` 的 `task.json` 与重读结果一致：revision `2`、status `context_ready`。任务属于解释链路需求，尚未保存模型写作后的完整结论。 |
| 源码证据 | `get_evidence` 返回五项，持久 ledger 同样五项：一项 `src/cart.js:9–13` 的 `receipt` 源码证据，四项明确的分析边界。源码证据具有内容 hash 和 Snapshot 绑定；Task Brief 保留七项 claims，其中目标和验收仍为 draft。 |
| 停止与未完成项 | 180.03 秒到达运行器时限，进程组以 SIGTERM 结束（exit `-15`）。未调用 `open_workbench`、`check_change` 或 `record_verification`；未创建第二、第三个任务；没有 verification record，fixture Git status 仍为空。不能声称修复、验证、Workbench 回看或三任务完整旅程通过。 |

该尝试证明默认已认证的 Codex 能通过临时配置连接最终包，模型能建立带源码证据的持久任务并重读。三任务端到端验收因传输重连占用大部分有界运行时间而未完成；Claude 的已登录模型旅程仍未验收。隔离安装、Doctor 健康状态与这些真实模型结果分别记录，不互相替代。

本次临时原始记录位于 `understand-codex-real-journey-ka4rpez_` 下的 `events.jsonl`、`run-result.json` 与 fixture 内 `.understand-code/tasks/42C24JTFJGTSAA34GASS5K4K0R/`。原始日志不作为公开附件，避免未来工具响应中可能存在的一次性 Workbench 令牌外泄；本文件只保留上述可核对的脱敏摘要。
