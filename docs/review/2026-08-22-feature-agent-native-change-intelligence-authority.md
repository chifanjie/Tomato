# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：`feature/agent-native-change-intelligence-authority`
> 基于 commit：`775e140 test: prove linked-worktree host root parity`

## 背景与动机

权威 Step16/WP6 要求 Root 绑定失败时仍能完成 MCP initialize 与 tools/list，并由 repository tools
返回稳定、结构化的 `workspace_binding_required` Tool Error Envelope。启动期 stderr/exit 2 只用于
语法上不安全、无法安全传给 CLI 的 Host 配置。

此前 Preview plugin adapter 会在启动 bundled MCP 前对所有 Root 做 `realpath` 与 Git 验证，并把
missing、regular file、non-repository 等合法形状但不可绑定的候选统一折叠成
`workspace_root_required` + exit 2。这样真实 official Host cache 无法暴露冻结的
`root_missing`、`root_not_directory`、`root_unavailable` 分类，也无法证明失败会话锁定与 fresh
进程恢复。

本切片在不改变公共 MCP/CLI schema 的前提下，把安全的绝对 Root 候选交给 bundled CLI 分类；同时
保留 adapter 对 relative、placeholder、control、oversize 与 option-like 输入的启动期拒绝。

## 改动策略

- Claude 的 `CLAUDE_PROJECT_DIR` 为 undefined 或空字符串时，不再伪造 Root；child argv 省略
  `--root`，由 CLI 返回 `root_missing`。
- 语法安全的绝对候选仍先 best-effort 执行 bounded `realpath` 与固定参数 Git top-level 探测：
  成功时传 canonical linked-worktree top-level；任一 FS/Git/输出校验失败时传回原绝对候选，由
  CLI 区分 `root_not_directory` 与 `root_unavailable`。
- relative、`${...}` placeholder、control、UTF-8 超长和 `--` 开头输入仍在 plugin adapter 中
  以 redacted `workspace_root_required` + exit 2 拒绝。
- 保持 `shell:false`、固定 argv、Git authority 环境清洗、timeout/maxBuffer、stderr 脱敏与现有 exports。
- 真实 official cache E2E 新增统一 binding-failure helper：完成 initialize、initialized、exact 11
  tools/list，并用合法参数调用 `get_repo_pulse` 与 `refresh_index`，对两次完整 Tool result 做 exact
  deep equality；随后 EOF 干净退出，stderr 为空且不得生成 `.understand-code`。
- Codex 在 existing non-repository cwd 得到 `root_unavailable` 后，测试把同一 cwd 变成有效 Git repo；
  同一 MCP 会话仍返回原错误，证明 RootBindingSession 永久 fail-closed。fresh valid linked-worktree MCP
  随后精确恢复原 Task。
- Claude 分别覆盖 absent 与 empty project root 的 `root_missing`、absolute regular file 的
  `root_not_directory`，并证明 file bytes 不变；relative 与 literal placeholder 继续走 adapter exit 2。
  每组错误后都由 fresh valid linked-worktree MCP 精确恢复原 Task、repository/worktree、Snapshot、
  revision 与 Verification replay。
- 原 linked spaces/CJK Root、六类 poisoned Git authority、双 Host official active cache、双 Chrome
  Workbench、v2 update、pinned-v1 reinstall、remove 与 Doctor 链全部保留。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Preview Host adapter | `packages/preview/src/codex-plugin-bin.mjs` | 对 safe absolute Root 做 best-effort canonicalization，失败时交由 CLI 分类；Claude missing/empty 时省略 `--root`；保留 syntactically unsafe exit 2 |
| Mandatory Host E2E | `packages/preview/test/plugin-clean-install.test.mjs` | 从真实 official cache 验证三类 Tool Error Envelope、会话永久锁定、无 Artifact 副作用与 fresh exact recovery，并保留原 Browser/lifecycle 全链 |

## Review 重点与结论

1. **分层正确性** — adapter 只拒绝不能安全转交的语法输入；安全绝对候选由 CLI 的 Root binding
   classifier 决定 reason，避免提前吞掉 Tool Envelope。
2. **稳定错误合同** — initialize/tools/list 必须可用，Pulse 与 Refresh 必须返回完整相同的
   `workspace_binding_required` result；不能只比 reason 子字段。
3. **永久失败与恢复** — 同进程环境改变后不得静默重绑；恢复必须由 fresh MCP 进程完成并 exact replay
   既有 Task identity。
4. **无副作用与脱敏** — binding failure 不得创建 `.understand-code`、修改 regular file 或泄露路径；
   unsafe adapter 失败仍只输出固定 redacted 文案。
5. **旧纵切未弱化** — linked-worktree authority、双 Browser、Evidence/Graph/Wiki、版本切换与最终清理必须
   继续通过。

独立 change-intent 与 contract 终审一致：P0 0、P1 0、current-path executable P2 0、blocking Test Gap 0。

## 测试情况

**已通过：**

- `node --check packages/preview/src/codex-plugin-bin.mjs`
- `node --check packages/preview/test/plugin-clean-install.test.mjs`
- scoped `git diff --check`
- `pnpm --filter @understand-code/preview typecheck`
- `pnpm --filter @understand-code/preview build`（fresh dist）
- 唯一真实 Host + Browser 门禁：
  `UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS=1 UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:plugins`
- 结果：1/1 pass，0 fail，0 skip；test 37.066 秒，总计 37.157 秒。
- 双 flag 同时强制，因此 Codex CLI、Claude CLI 或 Chrome 缺失都会失败，不能静默 skip。

## 可声明与不可声明

**可声明：**

- 当前本机真实 Codex/Claude official active cache 中的 bundled MCP 可以在 invalid Root 下完成
  initialize/tools/list，并稳定返回 `root_unavailable`、`root_missing`、`root_not_directory` Tool Envelope。
- Root error 在同一 MCP 会话内永久锁定且不产生 UC Artifact；fresh valid linked-worktree MCP 可以精确恢复
  原 Task/repository/worktree/Snapshot/revision/Verification。
- relative 与 unexpanded placeholder 仍被 adapter 安全拒绝；原双 Host Browser 与 lifecycle 没有回归。

**不可声明：**

- 不是会话内动态重绑或自动恢复；恢复需要新 MCP 进程。
- 不是所有 invalid Root 都进入 Tool Envelope；语法不安全输入仍是 startup exit 2。
- 未穷举 control/oversize、absolute missing/broken symlink、malformed fake-Git、所有 Host/Git 版本、OS、
  filesystem 与跨平台矩阵。
- 不是 credentialed/model-selected Codex/Claude chat、Gold/G2/G3、dynamic Roots 或正式 Surface Release gate。
- adapter Git 探测是 best-effort canonicalization，不是新的 authority、execution fence 或信任证明。
- 不证明 Provider Authority、strongWrites、signature、SBOM、SLSA/provenance、reproducibility 或 release-ready；
  `strongWrites` 继续 locked。

## 结论

🟢 Effective。真实 official Codex cache 在 existing non-repository cwd 中仍可完成 MCP 握手并对两个
repository tools 返回稳定 `root_unavailable`；同一 cwd 后来成为 Git repo 时会话仍保持原错误。真实
official Claude cache 对 missing、empty 与 regular-file project root 分别返回冻结的 `root_missing` 与
`root_not_directory`。全部失败路径无 Artifact 副作用并干净退出，fresh valid linked-worktree Host cache
随后 exact replay 原 Task；既有双 Host Workbench 与 v2/pinned/remove 生命周期保持全绿。可以精确提交。
