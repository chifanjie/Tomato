# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：`feature/agent-native-change-intelligence-authority`
> 基于 commit：`3638d57 test: prove secondary-session Host isolation`

## 背景与动机

权威 Step15 要求 Change Check 对当前可达的 Git 变化源保持“能精确证明才判定、不能证明就阻塞”。
`git add -N`（intent-to-add）是 Git 用户可直接进入的真实状态：Index 中只有空 blob 占位，实际内容仍来自
worktree。现有 Snapshot 已能诚实发布一条 `unstaged/added` 变化，但 Task Engine 只分析
`unstaged/modified`、staged added/modified 和 untracked added，因此该状态只能返回 blocking
`cannot_determine`。

本切片增加一个内部、有限、fail-closed 的 live intent-to-add profile；不改变公开 contracts、MCP API、
持久化 schema 或 legacy analysis profile。目标是让一次普通的 planned unstaged edit、intent-to-add 新文件与
untracked 新文件可以在同一 Snapshot 中得到精确行级分析与 Source Evidence，同时保持所有既有 profile 的
reason、稳定 ID 和 partial/whole-unknown 语义不变。

## 改动策略

- 仅当 actual Snapshot 满足以下条件时启用 `liveIntentToAddChanges`：
  - 1–16 个唯一路径，至少一条 `unstaged/added`；
  - 不含 staged/committed/conflict 或其他 kind；
  - 全集只允许 `unstaged/added`、`unstaged/modified`、`untracked/added`；
  - 每条变化均有 `contentDigest`。
- intent-to-add 的 actual bytes 始终从安全、no-follow 的 worktree 读取，并要求 SHA-256 与 Snapshot
  完全一致；不把 Index 中的空占位当成源码。
- added baseline 必须由 exact HEAD tree lookup 证明路径不存在，然后使用 empty-before → actual 的
  deterministic line diff；Graph symbol 必须与 actual bytes/range 精确锚定。
- 复用现有 full live Snapshot pre/post fence，精确比较 root、repository/worktree identity、HEAD、
  index/worktree/untracked/ignore digests 与 snapshotId；`git reset`、fully stage、字节漂移或任何全局
  live-state 漂移均整批返回 `unknown`、空 hunks、覆盖全部 actual IDs 的 global boundary。
- 复用每文件 8 MiB、整批 semantic bytes 32 MiB 和 1024 hunks 上限。任一路径、预算、Graph 或 fence
  失败都不保留部分成功 hunks。
- `liveIntentToAddChanges` 与旧 live-untracked profile 互斥；旧 staged、live-untracked、pure-unstaged
  分支及其 reason 字符串保持原样。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Snapshot producer regression | `packages/repository-state/test/snapshot.test.ts` | 用真实 `git add -N` 冻结 `.A` 状态、空 Index blob、唯一 `unstaged/added`、digest 与稳定 recapture |
| Change analysis | `packages/task-engine/src/repository-context-provider.ts` | 新增 bounded live intent-to-add profile，复用现有 HEAD absence、worktree bytes、Graph、预算与 full Snapshot fence |
| Provider regression | `packages/task-engine/test/repository-context-provider.test.ts` | 保留原 live-untracked 用例，并新增 modified + ITA + untracked 三路径完整分析及 reset 后 whole-unknown |
| Packed user vertical | `packages/preview/test/workbench-browser-packed.test.mjs` | 在唯一真实 Browser E2E 中加入 ITA Snapshot/Finding/Evidence/accept/Verification，并把当前 provider 源码绑定到 ephemeral candidate commit |

公开 contracts、ChangeCheck artifact、operation receipt、MCP shape、Dashboard production 与生命周期实现均未修改。

## Review 重点与结论

1. **Producer truth** — 真实 `git add -N` 必须产生唯一 `unstaged/added`，cached diff 为空，
   `git show :path` 为 empty blob，且不能同时出现 staged duplicate。
2. **Index 不冒充 actual** — actual content、line range、Graph node 与 Evidence hash 均来自 worktree bytes；
   Index placeholder 只通过全局 Snapshot fence参与状态绑定。
3. **旧 profile 不回归** — 原 live-untracked focused 用例完整保留；旧 staged/live-untracked/pure-unstaged
   reason、collapse 路径与稳定 Finding/Evidence ID 不漂移。
4. **Whole-batch fail closed** — ITA reset 为普通 untracked、stage transition 或其他 live drift 后复用旧
   Snapshot，必须丢弃所有 hunks并对全部 actual IDs 返回 global boundary。
5. **不把新增文件误报 planned** — packed Brief 只计划既有 `foo` symbol；Check 中只有 `foo` 为
   `planned_completed`，ITA 与 untracked 文件各自是 blocking `unplanned_change`，必须逐条显式 accept。
6. **真实 candidate authority** — 第一次 packed 重门暴露 candidate clone 只 overlay packed tests、遗漏未提交
   provider 的 fixture 缺口，导致 tgz 仍运行旧 provider并 whole-unknown。最终修复把 provider 源码加入
   `V1_OVERLAY_FILES`；v1 clean ephemeral commit及其派生 v2 candidate 均绑定当前生产字节，再从头通过
   assemble、verify、cold install、upgrade、rollback 与 Browser 全链。

独立 contract 与 change-intent 终审一致：P0 0、P1 0、current-path executable P2 0、
blocking Test Gap 0；结论为 SAFE TO COMMIT。

## 测试情况

**已通过：**

- repository-state ITA focused：1 passed，41 skipped。
- task-engine provider focused：12/12 passed；原 live-untracked 与新增 ITA mixed 两条真实 Git 路径均执行。
- `pnpm --filter @understand-code/repository-state typecheck`
- `pnpm --filter @understand-code/repository-state test`：82 passed，1 个既有 skip。
- `pnpm --filter @understand-code/task-engine typecheck`
- `pnpm --filter @understand-code/task-engine test`：命令 exit 0；传输保留其余 7 files/41 tests，随后单独
  `engine.integration.test.ts` 也 exit 0，用于补齐丢失的末尾 runner evidence。
- `node --check packages/preview/test/workbench-browser-packed.test.mjs`
- scoped `git diff --check`
- `pnpm --filter @understand-code/preview typecheck`
- `pnpm --filter @understand-code/preview build`（fresh dist）
- 唯一真实 packed Browser 门禁：
  `UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:workbench-browser`
  - 1 passed / 0 failed / 0 skipped，180.81 秒；
  - v1 tgz：87 entries，`sha256:2828066d2291207d828f9c5f9638e4592eddc47b5c1d95e4606b98ea1589510b`；
  - v2 tgz：87 entries，`sha256:c13d89bb163743dec5d83db44ac300c405a234d30d1240513b97220de859e33f`。

第一次 Browser 重门在 `planned_completed` 数量断言处失败并按首错停止。根因不是 Graph 或 matcher，
而是 candidate fixture 未把未提交 provider 带入 exact-HEAD clone。修复 overlay authority 后从头重建两份
candidate，同一完整门禁通过；未复用失败产物或放宽断言。

## 可声明与不可声明

**可声明：**

- 当前 Alpha 能对 1–16 个 bounded live paths 中的 intent-to-add added、unstaged modified 与 untracked
  added 进行 Snapshot-bound 行级分析；每条 actual bytes、range、Graph node 与 Source Evidence hash
  均精确绑定。
- 真实 `git add -N` 新文件不会被误报为 planned completion；在本次公开纵切中，它与普通 untracked
  新文件均形成精确 blocking unplanned Finding，经显式 accept 后才进入 Verification。
- Index/worktree/untracked/ignore 或 Snapshot identity 漂移会整批 fail closed；既有 staged、
  live-untracked 和 pure-unstaged 分析行为未被扩写或弱化。
- 当前本机 tuple 上，两份真实 unsigned Alpha candidate 均包含该 provider，实现可跨 managed
  v1→v2 upgrade→rollback 保持 Task/Finding/Evidence/Verification/Workbench 连续。

**不可声明：**

- 不支持超过 16 路径、staged + ITA 混合、delete、rename/copy、type change、conflict、binary、超预算、
  Graph ambiguity 或 committed delta。
- ITA 新文件不是 Brief 中已计划的新 symbol；本切片只诚实证明 `unplanned_change` + explicit accept，
  不宣称 planned add completion、required-change expectation 或 possible omission。
- 结果仍为 `legacy_summary`，不是 formal `evidence_backed_v1`、structured `diff_hunk` 或五维
  Completeness 证明。
- 两个 candidate 仍是当前本机 tuple 的 unsigned Alpha 测试产物；不证明 RC/Release、signature、SBOM、
  SLSA/trusted provenance、reproducibility 或 cross-platform。
- 不证明 current execution fence、Provider Authority 或 strong write；`strongWrites` 继续 locked。

## 结论

🟢 Effective。真实 `git add -N` 现在可以沿完整 Snapshot → Graph → Change Check → Finding → Source
Evidence → explicit accept → external Verification 路径工作；任何 live-state 或语义不确定性仍整批
fail closed。原 staged/live-untracked/pure-unstaged 合同未回归，最终 packed candidate 与 Browser 生命周期
已从头通过。可以精确提交。
