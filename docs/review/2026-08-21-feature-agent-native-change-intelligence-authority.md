# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-21 11:40 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：3d8ce95 fix: pin reused Workbench launches to current snapshot

## 背景与动机

Alpha 纵切已经能在仓外冷安装并完成 Pulse/Brief、Graph/Wiki、修改、Check 和
externally reported Verification。实际复测发现：同一 Workbench runtime 被复用后，第二次
`open_workbench` 的新 deep link 可能仍由首次启动的浏览器元数据服务，导致用户完成修改和
验证后看不到当前 Trace。当前改动修复这个真实用户路径，同时继续把 Provider Authority、
execution fence 和 `strongWrites` 保持 locked。

## 改动策略

保持 D-12 的 runtime singleton identity（canonical root + product version + worktree ID）不变。
每次 `open_workbench` 只为新 launch token 和 redeem 后的 Browser Session 保存不可变的
repository/snapshot binding；旧 Browser Session 继续使用原 binding。HTTP Brief、Context、
Trace 和 freshness 投影从 session binding 读取，而不是从 singleton 首次 output 读取。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| launch/session binding | `packages/workbench-runtime/src/index.ts` | 增加 per-open binding，修复复用 runtime 的 reader/handler 对象引用，并让 Brief/Context/Trace 使用对应 session binding |
| 回归覆盖 | `packages/workbench-runtime/test/workbench-runtime.test.ts` | 验证 G1 会话保持 G1、同端口复用后 G2 新会话获得 G2、reader 收到各自 pinned input |
| 安装产物 E2E | `packages/preview/test/cold-packed.test.mjs` | 在同一仓外安装的 MCP 进程中完成 verified 后再次打开 Workbench，读取当前 Trace 并断言脱敏 |

## Review 重点

1. singleton identity 不得把 snapshot/repository 错误加入 key，否则会违反复用合同。
2. 旧 deep link/session 不得被新 open 静默改写；新 token 必须是一次性的且绑定最新 snapshot。
3. 冷测必须消费 fresh、唯一的 tgz，并验证真实 Check/Verification Trace，而不是只测静态 fixture。
4. Trace 仍是 `externally_reported` 只读投影，不能被误报为独立执行或 strong write。

## 已识别风险

未发现阻塞问题。

## 测试情况

**已覆盖：**

- Workbench runtime typecheck/build：通过。
- Workbench runtime tests：6/6 通过。
- Preview typecheck/build/runtime：通过，Preview runtime 8/8。
- 单一 fresh tgz（tar 37 entries，SHA-256 `29d4f1e720b9e7c2604b12ce5b3d1c71a0198ae5115ef0950810e64712b2c915`）仓外 cold E2E：1/1 通过。
- 冷测覆盖 MCP initialize/EOF、Demo 与真实 `--root` Graph/Wiki、Pulse/Brief、外部修改、Check、真实 Node 行为验证、Verification/verified、重启幂等重放、Doctor 和卸载清理；新增 reopen Trace 断言当前 snapshot、计数、`externally_reported` 及 command/output 等字段脱敏。
- `git diff --cached --check`、远端 SHA 核验：通过。

**缺失/后置：**

- 不在本 Alpha 扩展 exhaustive crash-cut、三方竞态或跨平台组合矩阵。
- Graph/Wiki 仍是只读摘要 projection；Evidence→Source viewer、综合 Doctor/serve、双 Host 发行物升级/回滚、Provider execution fence、全局 rollback anchor、签名/SBOM/provenance 和跨平台加固进入 backlog。

## 结论

🟢 Effective：改动达成当前 Alpha 纵切意图，可继续使用已推送的单一安装产物。它不解锁
Provider Authority、execution fence 或 `strongWrites`，也不构成正式 Release。
