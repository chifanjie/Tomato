# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：`feature/agent-native-change-intelligence-authority`
> 基于 commit：`6d4055f fix: preserve Host root error envelopes`

## 背景与动机

权威 Step16/WP6 要求对 `root_missing`、`root_not_directory`、`root_unavailable`、
`root_not_allowed`、`root_conflict` 与 `secondary_session_required` 逐项触发并核对稳定 Tool Error
Envelope。上一切片已从真实 official Host cache 闭合前三项；生产代码也已把 Store manifest 的
repository/worktree identity 与当前绑定 Root 不一致映射为 `secondary_session_required`，但全仓没有
对应测试，无法证明 official cache Surface、会话永久锁定、无副作用与 fresh recovery。

本切片不改生产实现，只扩现有唯一双 Host + Chrome 生命周期 E2E。测试用身份不同的第三仓库承载一个
结构合法但属于原 linked worktree 的 foreign Store，真实触发 Runtime binding mismatch，并以
“首错后修复 Store、旧进程仍失败、新进程成功”的反事实关闭重复坏状态造成的假绿。

## 改动策略

- 在现有 sandbox 内建立确定性不同的第三 Git repository，要求 source、HEAD、index 与原 linked
  worktree 均不同，并冻结 source/index 原始字节。
- 先从 official Codex active cache 启动 fresh MCP，在第三仓库执行 `refresh_index` 与 Pulse，生成
  该仓库自己的合法 Store；冻结 repositoryId、worktreeId、sourceSnapshotId、Manifest identity 和
  递归 byte inventory，再将合法 Store 移到 sandbox backup。
- 对 Store inventory 按相对路径稳定排序，记录 file/directory type；regular file 记录 byte length 与
  SHA-256，拒绝 symlink 和特殊文件。原 linked Store、foreign copy、合法 Store 和两份 Host failure
  backup 均使用同一精确清单。
- 复制原 linked `.understand-code` 到第三仓库；要求 foreign Manifest identity 精确等于原
  Codex-created Task 的 repository/worktree identity，并与第三仓库 identity 均不相同。
- Codex 与 Claude 分别从各自 official active cache 启动 fresh MCP：
  - initialize/serverInfo、initialized、exact 11 tools/list 正常；
  - 首次 `get_task_brief(original taskId)` 返回完整 exact
    `workspace_binding_required/secondary_session_required` result；
  - callback 在任何修复前证明 foreign Store、合法 backup、source 与 index 零变化，把 foreign Store
    原子移到 Host 专属 backup，再复制合法 Store 回第三仓库；
  - 同一旧进程调用 `get_repo_pulse` 仍返回同一完整 Envelope，证明 RootBindingSession 已永久锁定；
  - EOF 后 exit 0、stderr 为空。
- 每个旧进程退出后，从同一 Host official cache 新启 MCP 绑定已修复的第三仓库，Pulse 必须成功且
  exact 返回先前冻结的第三仓库 identity；随后再 fresh 绑定正确 linked root，exact replay 原
  Task/repository/worktree/Snapshot/revision/Verification。
- Claude 测试前重新放回同一 linked foreign Store，确保两 Host 使用相同故障输入。最终再次核对
  两份 foreign backup、合法 backup、第三仓库 Store 与原 linked Store inventory；显式 repair 写入和
  failure no-side-effect 分开计算。
- 原 spaces/CJK linked Root、六类 poisoned Git authority、Root missing/file/unavailable、双 Browser、
  Evidence/Graph/Wiki、v2 update、pinned-v1 reinstall、remove 与 Doctor 全链均保留。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Mandatory Host Root E2E | `packages/preview/test/plugin-clean-install.test.mjs` | 新增合法/foreign Store identity 与 byte inventory fixture；双 official Host cache 的 `secondary_session_required`、永久锁定、显式修复、fresh secondary Pulse 与 linked Task recovery 纵切 |

生产证据链未修改：
`openRuntime` 捕获当前 Root identity → `ArtifactStore.readManifest` 对 foreign identity 抛
`manifest_inconsistent` → `RuntimeBindingError("secondary_session_required")` →
MCP `RootBindingSession.lockError` 永久锁定并返回固定脱敏 Envelope。

## Review 重点与结论

1. **真实 Runtime trigger** — foreign Manifest 必须结构合法、字节等于 linked Store，且 identity
   明确不同于第三仓库；不能用 corrupt/missing Artifact 冒充 secondary session。
2. **永久锁定反事实** — 首错后必须先恢复第三仓库合法 Store，再由同一旧进程调用第二个 Tool；若没有
   lock，第二次应成功或返回其他结果，因此仍为 secondary 才能证明锁定。
3. **Fresh recovery** — 不能只回原 linked root；fresh 同 Host 进程还必须在修复后的第三仓库成功
   Pulse 并 exact 返回第三仓库 identity。
4. **无副作用** — failure 前后 foreign Store/source/index/合法 backup 必须 byte-exact；测试自身的
   rename/copy repair 必须显式区分，原 linked Store也必须在全链后保持精确 inventory。
5. **Surface authority** — Codex server 来源于官方 `plugin add` installedPath，Claude server 来源于
   官方 active list installedPath；两者都保留现有 Git authority poison 和 Root 选择合同。
6. **旧能力未弱化** — 双 Browser 与完整生命周期链保持同一条 mandatory gate，不增加第二条重 E2E。

独立 contract 与 change-intent 终审一致：P0 0、P1 0、current-path executable P2 0、
blocking Test Gap 0。

## 测试情况

**已通过：**

- `node --check packages/preview/test/plugin-clean-install.test.mjs`
- scoped `git diff --check`
- `pnpm --filter @understand-code/preview typecheck`
- `pnpm --filter @understand-code/preview build`（fresh dist）
- 唯一真实 Host + Browser 门禁：
  `UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS=1 UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:plugins`
- 命令成功完成，wall 约 38.8 秒，无残留进程。该 script 精确运行一个普通 top-level Node test；唯一
  `t.skip` 在 require-hosts flag 下会先失败，Chrome 缺失在 require-browser flag 下也会失败。因此
  成功退出等价于 1 passed、0 skipped。工具传输未保留 reporter 汇总文本；代码和输入未变，按分层门禁
  纪律未为显示性摘要重复同一重门。

## 可声明与不可声明

**可声明：**

- 当前本机真实 Codex/Claude official active cache 遇到结构合法但属于另一 repository/worktree identity
  的 Store 时，能在 initialize/tools/list 后稳定返回完整 `secondary_session_required` Tool Envelope。
- 首错后即使磁盘已恢复为当前仓库合法 Store，旧 MCP 进程仍永久 fail-closed；只有 fresh 进程可读取
  修复后的第三仓库 Pulse。
- failure 不修改 foreign Store、第三仓库 source/index、合法 Store backup 或原 linked Store；fresh
  correct-root 进程可以 exact 恢复原 Task 与 Verification。

**不可声明：**

- Store 复制或迁移是受支持产品功能；复制只用于构造结构合法的 foreign identity fixture。
- 不是会话内动态重绑、自动修复、quarantine 或删除 foreign Store；恢复需要测试显式 repair 与新进程。
- 不证明 additional-root 通用路由、`root_not_allowed`、`root_conflict`、并发/race、所有 Host/Git
  版本、OS、filesystem 或跨平台矩阵。
- 不是 credentialed/model-selected Host chat、Gold/G2/G3、dynamic Roots 或正式 Surface Release gate。
- 不证明 Provider Authority、execution fence、strongWrites、signature、SBOM、provenance、
  reproducibility 或 release-ready；`strongWrites` 继续 locked。

## 结论

🟢 Effective。真实 official Codex 与 Claude active cache 均已证明：绑定第三仓库却读取原 linked
worktree 的合法 foreign Store 时，首个 Task Tool 触发固定 `secondary_session_required`；即使随后把
磁盘恢复为第三仓库自己的合法 Store，同一 MCP 进程仍保持锁定。fresh 同 Host 进程可成功读取第三仓库
Pulse，fresh linked-root 进程可 exact replay 原 Task/Verification；全部失败输入、备份、source/index 与
原 Store 字节均有前后证据。可以精确提交。
