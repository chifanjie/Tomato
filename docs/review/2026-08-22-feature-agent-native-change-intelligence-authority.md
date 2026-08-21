# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：c87e025 feat: bind change checks to exact code hunks

## 背景与目标

Alpha 已能记录外部执行的 Verification，但恢复路径此前不够精确：任意历史 failed/blocked/flaky 记录都可能让
`verification_required` 退回 `in_progress`，即使该记录已被后续 passed attempt supersede；进入 `verified` 时也没有
要求 latest record 对 Plan Entry 的 Acceptance Claims 做双向精确覆盖。Workbench 同时按历史记录计数，可能把 partial
passed 显示为成功，或遗漏 blocked/flaky 的当前失败处置。

本切片把失败恢复绑定到调用方显式指定的、当前 Snapshot 与当前 Plan Entry 的 exact latest attempt，并让 Engine gate
与 Workbench 当前处置使用同一套覆盖语义。Verification 仍然是 externally reported，不提升为受信执行或 strong write。

## 实现策略

- `transition_status` 增加可选 `verificationRecordId`；仅 exact
  `verification_required → in_progress` 可以携带该字段。
- 恢复记录必须属于当前 Snapshot、当前 Plan Entry，必须是 exact latest attempt，且状态为
  `failed | blocked | flaky`；缺失、未知、已 supersede、passed 或错误 transition 均 fail closed。
- `verified` gate 要求每个 required Plan Entry 的 latest record 为 passed，或为已明确接受的 skipped，并且
  `claimIds` 无重复、与 Entry 的 `acceptanceClaimIds` 双向精确相等。
- Workbench Trace 保留当前 Snapshot 内的全部 attempts，但 summary 只按每个 required Entry 的 latest attempt 计算：
  exact-covered passed/accepted skip 计为 passed，failed/blocked/flaky 计为 failed，其余计为 pending。
- 跨 Snapshot 历史仍保留在持久 Verification ledger 中；Workbench 投影不输出它们，以满足 session 的严格
  Snapshot 绑定，不会改写或删除持久记录。

## 改动范围

| 模块 | 主要文件 | 作用 |
|---|---|---|
| Contracts | `packages/contracts/src/task.ts`、generated schemas/tests | 为恢复 transition 增加显式 Verification record ID，并限制合法目标状态 |
| Task Engine | `packages/task-engine/src/mutation.ts`、integration test | exact-latest recovery gate 与 verified exact claim coverage |
| CLI / Workbench | `packages/cli/src/handlers/tools.ts`、MCP integration test | current-Snapshot attempts 投影与 latest disposition 汇总 |
| Packed E2E | `packages/preview/test/workbench-browser-packed.test.mjs` | 真实失败命令、显式 superseding retry、verified 与 Trace 恢复链 |

## Review 结论

🟢 Effective。定向独立终审确认前次两个 current-surface blocking 均已关闭，无 remaining blocker：

1. partial/excess claim coverage 与未接受的 skipped 不再显示为 passed，而是保守进入 pending。
2. latest blocked/flaky 与 failed 一起计入 failed，不会产生 `required=1 / passed=0 / failed=0 / pending=0`。
3. Workbench 输出当前 Snapshot 的全部 attempts，与 runtime strict Snapshot parser 一致；过滤只生成投影视图，
   不改变持久 ledger。
4. older failed attempt 在 latest passed 后不能再次授权恢复；错误 ID 或错误 transition 均零推进拒绝。
5. passed record 缺少、重复或额外 Acceptance Claim 时，`verified` gate structured fail closed。

## 门禁证据

- Contracts package：13 files / 135 tests；52 generated schemas 与 28 fixtures verify 通过。
- Task Engine package：8 files / 64 tests；最终 integration focused 27/27。
- CLI typecheck/build；CLI package：12 files / 81 tests。
- Preview typecheck/build。
- 单一仓外安装的真实 Chrome packed E2E：1/1，0 skipped；真实执行 attempt 1 失败命令，再用显式
  superseding attempt 2 成功恢复到 verified，并在 Workbench 保留两次尝试、显示 latest 全绿处置。
- 最终安装产物 SHA-256：`08a7a3f15289699cbb1c5ec46dd96af05b0c1069c7175cf32cc93a729db69df9`；
  87 entries。
- `git diff --check` 通过。

## 明确限制与后续 backlog

- Verification 结果仍由外部执行者报告；Workbench 明示 `externally_reported`，没有 execution fence 或独立命令证明。
- 跨 Snapshot Verification 历史保留在持久 ledger，但当前 Workbench session 只投影其绑定 Snapshot 的 attempts。
- Provider Authority、全局 rollback anchor、正式执行 fence、签名/SBOM/provenance 与跨平台发行加固仍未闭合；
  `strongWrites` 必须继续保持 locked。
- 当前 Alpha 完成的是可恢复的本地 Task/Verification 用户闭环，不宣称完整 Step 15 Provider-backed production gate，
  也不提前关闭 Step 16/17 的 Gold Set、正式 Host 模型调用或 Release Gate。

## 最终判断

用户现在可以在真实安装产物中看到一次失败 Verification，明确选择该 Plan Entry 的当前失败 attempt 回到修改状态，
执行修复并以 superseding passed attempt 恢复到 `verified`。Workbench 保留可追溯尝试链，同时只把当前有效处置计入
summary；失败、partial coverage 与过期记录不会被误报为成功。能力边界保持诚实，适合精确提交。
