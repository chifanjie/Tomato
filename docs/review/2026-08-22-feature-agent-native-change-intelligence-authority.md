# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 15:59 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：51b2cec docs: document host plugin lifecycle

## 背景与动机

当前 Change Check 仍是兼容的 legacy payload，但此前没有按 D-24 标注为
`legacy_summary`。更严重的是，空 Findings 会被生命周期误当成没有阻塞项：历史
Task 可进入 `verification_required`，已处于该状态的历史 Task 还可继续进入
`verified`。冻结合同明确规定 legacy 空 Findings 不构成 clean evidence。

本切片关闭这条 false-clean 路径，同时保持历史 Change Check、Artifact、operation
receipt 的持久化 bytes 与 digest 完全不变；它不伪装成尚未实现的
`evidence_backed_v1` strong profile。

## 改动策略

- 新增纯内存 `classifyChangeCheckV1()`，当前兼容 payload 固定投影为
  `{ profile: "legacy_summary", emptyFindingsAreClean: false }`。
- `check_change` 的 strict MCP 输出携带该读取分类；receipt 仍只保存原有
  `{ changeCheck, mutation }`。
- legacy writer 在原本会得到零 Findings 时，改写一个 blocking
  `cannot_determine`，并复用既有 Claim/Evidence 管线生成 snapshot-bound
  `analysis_boundary`。
- 同一 predicate 同时守住 `check_required → verification_required` 与历史已 pin
  空 Check 的 `verification_required → verified`。
- replay 从 durable receipt 重建读取分类，不重新读取或分析当前仓库状态，不写入
  Artifact，也不推进 revision。
- MCP 文本、CLI trace、embedded Workbench、React Task-first Workbench 都明确展示
  legacy summary 与“空 Findings 不是 clean evidence”。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Contracts | `packages/contracts/src/change.ts`, `packages/contracts/src/mcp.ts`, `packages/contracts/schemas/v1/check_change-output.schema.json` | 读取分类与 strict MCP 输出字段 |
| Contract tests | `packages/contracts/test/task-evidence-change.test.ts`, `packages/contracts/test/mcp-contracts.test.ts` | 不改 persisted payload、分类必填与输出 identity 回归 |
| Task Engine | `packages/task-engine/src/change-intelligence.ts`, `packages/task-engine/src/mutation.ts` | zero-draft boundary、receipt 隔离、两处生命周期拒绝 |
| Engine tests | `packages/task-engine/test/engine.integration.test.ts` | writer、replay、历史两门 fail-closed 回归 |
| CLI projection | `packages/cli/src/handlers/tools.ts`, `packages/cli/test/mcp.integration.test.ts` | MCP 文本/结构化分类与 trace 投影 |
| Workbench runtime | `packages/workbench-runtime/src/index.ts`, `packages/workbench-runtime/test/workbench-runtime.test.ts` | strict pair parser 与 embedded UI 文案 |
| React Dashboard | `packages/dashboard/src/components/taskFirst/TaskFirstWorkbench.tsx`, `packages/dashboard/src/components/taskFirst/__tests__/TaskFirstWorkbench.test.ts` | Task Check legacy/no-clean 可见标识 |
| Packed E2E | `packages/preview/test/workbench-browser-packed.test.mjs` | 同一 tgz 的 MCP、React DOM、trace 三层断言 |

## Review 重点

1. **持久化兼容** — Change Check payload、Artifact schema、receipt schema、reference
   fixtures 都不得变化；classification 只能是 reader projection。
2. **空 Check fail-closed** — 新 writer 不得产出空成功；历史空 Check 在两个成功门都
   必须 `current_check_required`，且 revision 不推进。
3. **Replay 纯度** — replay 不重新跑 Snapshot/analyzer，不生成新持久化内容。
4. **Surface 一致性** — MCP、trace parser、fallback Workbench 与 React Dashboard
   必须对相同字段给出相同语义。
5. **不越权声明** — 本切片不是 formal Actual Change、Diff Hunk、五维
   Completeness、Provider authority 或 strong writes。

## 已识别风险

未发现 P0、P1、current-path executable P2 或 blocking Test Gap。

非阻塞残余：`check_change` V1 新增 required reader-projection 字段；当前单一 tgz 内
producer/consumer 同版本，旧 strict 外部 client 需要随包升级。正式稳定 API 前需纳入
版本兼容策略。Formal `evidence_backed_v1`、repository final-tree Delta、strong
Evidence、五维 Completeness、Provider authority、execution fence 与
`strongWrites` 继续 open/locked。

## 测试情况

- Contracts focused：58/58。
- Contracts package：136/136；52 schemas、28 fixtures、14 packed entrypoints 全绿。
- Task Engine focused：30/30；package：69/69。
- CLI focused：6/6。
- Workbench runtime focused：10/10。
- Dashboard focused：2/2。
- Contracts、Task Engine、CLI、Workbench runtime、Dashboard typecheck/build 全绿。
- Fresh Preview typecheck/build 全绿。
- 唯一 packed Chrome E2E：1/1，0 skip，29.17s。
- tgz SHA-256：`1fea3bd5a0aaf08e76effd2381337a16e6fd9cbc51b27c7f0ae8c7c3a4aea50b`；87 entries。
- scoped `git diff --check` 通过。

## 结论

🟢 Effective。legacy Change Check 现在被诚实标识，空 Findings 不再能被解释为
clean evidence；新写入、历史生命周期、replay 与用户可见 Surface 均已闭合，且没有
改写历史持久化语义。可以精确提交。
