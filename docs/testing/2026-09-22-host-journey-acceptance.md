# 2026-09-22 真实 Host 三任务验收

本轮通过默认已认证的 Codex，实际完成“解释源码 → 修复边界 bug → 小改动并验证”：解释已保存并重读；两个独立修改 Task 均通过工具门禁成为 `verified`，真实测试分别 5/5、6/6。随后另一个只读模型会话成功重读两个任务的最终状态。安装和 Doctor 验收保留在 [前轮记录](./2026-09-21-isolated-host-acceptance.md)，不代替本轮真实模型结果。

## 准备与边界

仅使用官方 `codex login status` / `claude auth status --json` 检查默认配置，保留布尔值和方式：Codex `loggedIn=true`、`authMethod=chatgpt`；Claude `loggedIn=false`、`authMethod=none`。没有读取、复制或打印凭据，没有修改全局安装或配置。Claude 真实模型旅程尚未验收。

复用上一轮自造购物车 Git fixture（初始 commit `4492e1cf3bf5c9bc2fd5d387bef973535dd37f1e`）。开始前源码 Git status 为空，已有解释 Task 为 revision 2、`context_ready`。模型恢复该任务，把分析结论落盘；随后为运费阈值修复和 USD 字段各创建独立任务，实际修改源码、运行 `node --test`、检查变化、记录验证。验收依据原始工具事件、持久产物和实际源码差异，没有手工写入任务或验证数据。

使用 `codex exec --ignore-user-config --ignore-rules --ephemeral --sandbox workspace-write --json`，仅通过一次性 `-c` 配置本地 MCP、临时 state/log 目录和 `history.persistence="none"`，不传模型参数。主会话的工具 allowlist 包含 12 个产品工具，包括后台索引的 `index_job`。本 fixture 已有索引，因此没有触发首次索引的 pending 分支。

上一轮 WebSocket 重试消耗了大部分 180 秒期限。本轮查阅本机 CLI help 与 [官方配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)：自定义 provider 支持 `supports_websockets=false` 与 `requires_openai_auth=true`，内置 provider 不可覆盖。因此用一次性 provider 配置指向相同的官方 ChatGPT endpoint，选择 HTTPS 传输，不传 `-m`。本轮未出现 WebSocket 重连；主会话有一次 HTTPS 响应流解码中断，CLI 自动重连后继续。

## 实际包与运行范围

- Codex CLI `0.155.0-alpha.9.2`，Node.js `26.0.0`，macOS。
- 将成功构建的完整 Preview dist（273 个文件）复制到临时目录，两个模型会话均使用同一份不可变副本。
- CLI bundle SHA-256：`0fad0dfba326970f140bbe528ce777effbe8ebc9a6c7a76a2983c2c89742e77c`。
- 主会话运行 600.03 秒后被运行器截止；两个修改在截止前已经分别于 377.19 秒、576.09 秒成功转为 `verified`。没有把运行器退出码 `-15` 隐瞒为正常完成。
- 只读续办仅开放 `get_task_brief`，65.97 秒正常退出（exit 0）；未重复建 Task、修改文件或重跑实现流程。
- 后续源码的后台 worker 环境净化、轮询文案、revision 错误映射和前端搜索 Worker 修正不属于这个 bundle。它们由对应定向测试及最终包回归另行验证；不能把本次模型旅程外推成后续所有包的验收。

## 执行结果

| 任务 | 持久 Task / revision | 实际行为及结果 |
| --- | --- | --- |
| 解释调用链 | `42C24JTFJGTSAA34GASS5K4K0R` / 3 / `context_ready` | Host 实际读取源码、README 和测试，调用 `record_analysis` 保存三项结论与一项未知，随后重读 analysis。解释任务没有被包装为代码验证通过。 |
| 修复满 100 免邮 | `7PEEB8V8JM2MSRSQ3SFQJY1QW7` / 18 / `verified` | 确认 goal、acceptance、plan；把 `amount > 100` 改为 `amount >= 100`，增加 100 边界回归；实际 `node --test` 为 5/5、exit 0；刷新 Snapshot、`check_change`、记录 verification 后通过状态门禁。 |
| 增加 USD 字段 | `4R1M18R44TEQWKB7D8HWCE3GMT` / 18 / `verified` | 新 Task 以前一个修改后的 Snapshot 为基线；收据增加 `currency: 'USD'`，更新已有断言并增加满 100 的完整收据测试；实际 `node --test` 为 6/6、exit 0；再次完成刷新、检查、记录验证与状态门禁。 |

主会话共有 52 次真实 MCP 调用完成事件：48 次成功，4 次错误后由模型纠正并继续。它实际调用了 `build_task_brief`、`get_task_brief`、`get_evidence`、`search_context`、`update_task`、`refresh_index`、`check_change`、`record_verification` 与 `open_workbench`，并非测试客户端模拟模型调用。

两个修改 Task 的 `task.json`、`change-check.json`、`verification.json` 与真实工具响应一致。源码 diff 只修改 `src/cart.js` 和 `test/cart.test.js` 的上述行为。验收人员额外独立运行最终 fixture 的 `node --test`，结果仍为 6/6、exit 0，未跳过或取消测试。

## 验证记录与历史范围

| 项目 | 运费修复 | USD 字段 |
| --- | --- | --- |
| Check ID | `change-check:cbce45c0996c31095fcbdc` | `change-check:7ff5efb4a50cf0251f8675` |
| Verification ID | `verification:0030fbf778a2e2370d0af3` | `verification:5987ce13d92fb18534c01f` |
| 验收 Claim | `claim:acceptance:e26d545bc00477558a1bec` | `claim:acceptance:e45789629a3b23f41423e2` |
| 命令 / 结果 | `node --test` / passed / exit 0 / 5 tests | `node --test` / passed / exit 0 / 6 tests |
| 实际 Snapshot | `snapshot-229cbd29d3c30d878114cc75cf3100bf0c52a5e1c09848473cc7553d635d1977` | `snapshot-72e2db84e942c0918f593b4de17acaa35a0d5374a85527e403e9ef794bf9d43f` |

运费修复的 actual Snapshot 恰好是 USD Task 的 baseline Snapshot。前者验证是那一历史状态的通过记录；后续 USD 修改后的最终源码由第二份验证覆盖。只读续办的模型也在最终回答中正确区分这两个范围。

静态变更检查并非零不确定项：运费修复有 1 项 `planned_completed` 和 5 项 `cannot_determine`；USD 修改有 6 项 `cannot_determine`，包含 legacy summary 无法完成可信自动分析的边界。Host 逐项用 `accept_finding` 留下源码检查与实际测试的理由，再进入验证阶段。例如未改 README/subtotal 是符合需求的有意保留，测试变更则由实际断言与通过结果说明。验收人员核对了这些理由与真实 diff，没有把 accepted finding 当作静态自动证明。这次验证的是 `local_durable_v1` 的 Host 工作流，不代表 Provider strong 隔离或自动语义证明。

## Workbench 与恢复证据

解释阶段的 `open_workbench` 返回私密一次性深链。验收人员在本机通过该 token 完成纯 HTTP launch（200）并读取相同 Task 的 analysis API（200）：响应包含 11 项 claims、9 项 analysis items 和真实 receipt 解释。没有使用或控制浏览器；此项证明任务能经 Workbench API 回看，不能替代浏览器视觉与交互验收。该一次性 token 已用于验收，不在文档中公布。

解释中的三项结论引用了真实 `receipt` 证据（`src/cart.js:9–13`，带内容 hash 与 Snapshot）。Host 确实读取了整个源码文件，但 subtotal 算法与 shippingFee 条件没有分别绑定到自己的行范围。因此这里只确认真实阅读、分析持久化与证据身份绑定，不宣称逐断言引用定位已经完整准确。

主会话到期退出后，另一个真实模型会话成功从相同仓库读取两个 Task 的 summary，均为 `verified` / revision 18，证明跨会话结果可恢复。续办提示误写了不支持的 `section="verification"`，导致另两次读取被正确返回 `invalid_arguments`；实际 schema 支持的是 `verification_plan`。这是验收提示错误，不是产品回归。上述 Verification ID、命令、结果和绑定来自主会话真实 `record_verification` 响应及独立读取的持久 `verification.json`，不假称续办成功读取了一个不存在的 verification 分区。

## 本轮观察到的错误与限制

- `search_context` 的 `pathPrefixes: ["src/", "test/"]` 被严格路径校验拒绝。模型去掉尾部斜杠后恢复；这是一个真实的输入体验改进点。
- 模型漏确认部分计划项时，`planned` 转换正确返回 `plan_not_confirmed`。模型补齐确认后继续，没有绕过门禁。
- 此后模型错误使用 expectedRevision 6（实际仍为 5）请求 `in_progress`，却收到 `internal_error`，errorId 为 `error:67ef5bbc-61c3-45d4-9b03-b41de3d2c98b`。准确请求已交回主任务修正错误映射；本次固定包仍包含这一问题。模型随后读取/使用正确 revision 恢复。
- 模型给 `transition_status` 添加不支持的 `verificationRecordId` 字段时被拒绝，移除该字段后成功。验证绑定实际已经由前一次 `record_verification` 持久保存。
- Claude 默认未认证，因此本轮没有 Claude 的真实模型旅程。该限制不影响已完成的 Codex 验收，也不意味着需要重新登录 Codex。
- 本 fixture 很小且已有索引，没有检验真实大仓的冷启动后台索引、浏览器渲染或正式知识发布；这些不应由三任务通过结果推导。

会话日志及冻结包位于临时目录 `understand-codex-host-journey-20260922-sj1vxryg`，包括 `invocation.json`、`events.jsonl`、脱敏 `timeline.jsonl`、`run-result.json`、`workbench-readback.json`、`acceptance-summary.json` 与 `readback/`。原始日志含一次性链接，不作为公开附件；临时目录也不是永久存储。本文件保留 task/check/verification/snapshot 身份与关键实际结果。收尾检查对应 temp bundle 的 Codex/Node 残留进程为 0。
