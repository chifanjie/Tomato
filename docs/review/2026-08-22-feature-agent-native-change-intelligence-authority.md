# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 12:37 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：4208cde test: verify host plugin version recovery

## 背景与动机

现有 Alpha Change Check 已能精确分析 bounded staged modified 文件，但仍有两个相连的用户路径缺口：

1. file Graph node 生成的 path-only PlannedChange 会把同文件任意 symbol hunk 当成完成，造成 `planned_completed` false success；
2. staged-added 文本文件只能进入 unknown，无法作为精确 `unplanned_change` 下钻到 Evidence/Graph。

本切片关闭这两点，并继续保持 legacy Alpha、Provider authority 与 `strongWrites` locked；不扩张到 delete、rename、committed 或 formal strong Check profile。

## 改动策略

- `planned_completed` 只允许存在 `symbolId` 的 PlannedChange 精确命中 hunk `nodeIds`；path-only plan 必须 fail closed 为 `cannot_determine`，且不能消费同路径 actual hunk。
- staged 分析集合保持 1–16 个唯一路径，允许 `modified|added`。added 路径只有在 exact baseline HEAD 上通过 bounded、literal Git tree 查询证明路径不存在时才成立。
- added 的 actual bytes 继续要求 Index、worktree 与 Snapshot digest 三方完全一致，并沿用全局 HEAD/Index pre/post fence、Graph anchor、32 MiB semantic bytes、1024 hunk 上限及 whole-analysis unknown 语义。
- 真实 packed E2E 用一个 planned staged-modified `foo` 与一个后来 staged-added 文件：前者完成，后者成为 blocking unplanned；公开接受该 Finding 后只按原 `foo` acceptance claims 执行外部 Verification。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Change matching | `packages/task-engine/src/change-intelligence.ts` | 禁止 path-only plan 通配同文件 hunk |
| Repository analysis | `packages/task-engine/src/repository-context-provider.ts` | bounded staged-added baseline absence、bytes 与 fence 分析 |
| Provider focused regression | `packages/task-engine/test/repository-context-provider.test.ts` | added happy、worktree drift、baseline-path-exists fail closed |
| Engine focused regression | `packages/task-engine/test/engine.integration.test.ts` | path-only plan 不完成、不消费 hunk，unplanned Source Evidence 保留 |
| Packed browser E2E | `packages/preview/test/workbench-browser-packed.test.mjs` | exact modified+added Snapshot → Check → Evidence → accept → Verification → Workbench |

## Review 重点

1. **Baseline absence authority** — 只有 exact HEAD、validated path、`--literal-pathspecs`、bounded `ls-tree -z --full-tree` 成功且零输出才证明 added；错误、超限或非空必须 unknown。
2. **No false completion** — 缺 `symbolId` 的 plan 不得产出 `planned_completed`；同路径 hunk 必须继续形成独立 `unplanned_change` 与 source Evidence。
3. **Whole-set fail closed** — staged 集合任一路径、预算、Graph、HEAD 或 Index fence 失败，都必须丢弃已生成 hunks，返回单一 global boundary 覆盖全部 actual IDs。
4. **Honest Verification** — 接受 added Finding 只表示显式 disposition；Verification 仍只覆盖原 `foo` acceptance claims，不把 added 文件误报为 planned 或 verified obligation。

## 已识别风险

未发现 P0、P1、current-path executable P2 或 blocking Test Gap。

非阻塞残余：formal primary-disposition、structured `diff_hunk`、五维 Completeness、execution/worktree fence 与 `strongWrites` 仍 locked；added 仅支持可安全读取且可映射 Graph 的 UTF-8 文本。empty、binary、mixed layers、delete、rename、committed 继续返回 unknown。Git 子进程独立 wall-time cap 仍是继承的 availability backlog。

## 测试情况

**已覆盖：**

- Task Engine focused：2 files / 38 tests 通过。
- Task Engine typecheck 通过。
- Task Engine package build/tests：67/67 通过。
- Preview typecheck 与 fresh build 通过。
- 强制真实浏览器 packed gate：`UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:workbench-browser`，1/1 通过，26.5 秒，0 skipped。
- 真实 tgz SHA-256：`0324b5c05ac94abf9a8ccbd5a859fb46b0d12b140910e9f2a9eae1006ee44392`；87 entries。
- `git diff --check` 通过。

**真实路径断言：**

- staged-modified `foo` 精确 `planned_completed`；
- staged-added 文件精确 blocking `unplanned_change`；
- 两份 Evidence 均绑定 exact Snapshot、line range、content hash 与 Graph node；
- 公开 `accept_finding` 后外部 Verification 到 `verified`；
- 既有 Workbench Source → Graph → Wiki → Task 与 lifecycle 链保留。

## 结论

🟢 Effective。该切片关闭了 path-only false success，并把 staged-added 文本文件纳入 exact unplanned Evidence 路径；所有不确定情况仍 fail closed，可以精确提交。
